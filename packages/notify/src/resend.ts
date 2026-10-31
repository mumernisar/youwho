import type { Notifier, NotifyLog, OwnerEvent } from './events';
import { render, renderDigest, type Rendered } from './templates';

const HOUR_MS = 3_600_000;
const MAX_PER_HOUR = 20;

export interface ResendOptions {
  apiKey: string;
  from: string;
  to: string;
  siteUrl?: string | undefined;
  log: NotifyLog;
  /** Injectable for hand checks; defaults to Date.now. */
  now?: () => number;
  fetch?: typeof fetch;
}

/**
 * Sends owner emails through Resend's REST API (plain fetch, no SDK). At most 20 per hour; the rest
 * wait in memory and go out as one digest when the hour rolls over. `send` never throws.
 */
export class ResendNotifier implements Notifier {
  private windowStart = 0;
  private sent = 0;
  private held: OwnerEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly o: ResendOptions) {}

  private now = () => (this.o.now ?? Date.now)();

  async send(event: OwnerEvent): Promise<void> {
    try {
      this.rollWindow();
      if (this.sent >= MAX_PER_HOUR) return this.hold(event);
      this.sent++;
      const slug = 'slug' in event ? event.slug : '';
      await this.post(render(event, this.o.siteUrl), `${event.type}:${slug}:${Math.floor(this.now() / 60_000)}`);
    } catch (err) {
      this.o.log.warn({ err, event: event.type }, 'owner email failed; dropped');
    }
  }

  private rollWindow(): void {
    const t = this.now();
    if (t - this.windowStart >= HOUR_MS) {
      this.windowStart = t;
      this.sent = 0;
    }
  }

  private hold(event: OwnerEvent): void {
    this.held.push(event);
    if (this.timer) return;
    const wait = Math.max(1000, this.windowStart + HOUR_MS - this.now());
    this.timer = setTimeout(() => void this.flush(), wait);
    this.timer.unref?.();
  }

  /** Send the digest for held events. Exposed so a hand check can trigger it. */
  async flush(): Promise<void> {
    this.timer = undefined;
    const events = this.held.splice(0);
    if (events.length === 0) return;
    try {
      this.rollWindow();
      this.sent++;
      await this.post(renderDigest(events, this.o.siteUrl), `digest:${Math.floor(this.now() / 60_000)}`);
    } catch (err) {
      this.o.log.warn({ err, events: events.length }, 'digest email failed; dropped');
    }
  }

  private async post(mail: Rendered, idempotencyKey: string): Promise<void> {
    const res = await (this.o.fetch ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.o.apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ from: this.o.from, to: [this.o.to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new TypeError(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
