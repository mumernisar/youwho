import type { Notifier, NotifyLog, OwnerEvent } from './events';

/** Used when there is no RESEND_API_KEY: events go to the log. */
export class ConsoleNotifier implements Notifier {
  constructor(private readonly log: NotifyLog) {}

  async send(event: OwnerEvent): Promise<void> {
    this.log.info({ event }, `owner event: ${event.type}`);
  }
}
