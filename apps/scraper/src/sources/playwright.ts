import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { fail, isAppError } from '@youwho/errors';
import { sleep, type PageRead, type PageSource, type ReadStage } from './types';

const MAX_BYTES = 5 * 1024 * 1024;
const BLOCKED_TYPES = new Set(['image', 'media', 'font', 'stylesheet', 'websocket', 'manifest']);
const POLL_MS = 750;
const CHROMIUM_ARGS = ['--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--renderer-process-limit=2'];

export interface PlaywrightOptions {
  /** Hosts (and their subdomains) a page may load from. */
  allowedHosts: readonly string[];
  /** After navigation the page must end up on this host, otherwise it asked for a sign-in. */
  expectedHost: string;
  /** Give up looking for the data this long after the page opened. */
  findTimeoutMs?: number;
}

interface FrameHit {
  data: string | null;
  tooLarge: boolean;
  logic: string;
}

/** Runs inside each frame in the browser. Only strings come back; nothing from the page runs in Node. */
function inspectFrame(max: number): FrameHit {
  const el = document.querySelector('script#data[type="application/json"]');
  if (!el) return { data: null, tooLarge: false, logic: '' };
  const text = el.textContent ?? '';
  if (text.length > max) return { data: null, tooLarge: true, logic: '' };
  const logic = [...document.querySelectorAll('script:not([src])')]
    .filter((s) => s !== el && /getElementById\(\s*['"]data['"]\s*\)/.test(s.textContent ?? ''))
    .map((s) => s.textContent ?? '')[0];
  return { data: text, tooLarge: false, logic: logic ?? '' };
}

const hostAllowed = (host: string, allowed: readonly string[]) =>
  allowed.some((d) => host === d || host.endsWith(`.${d}`));

export class PlaywrightPageSource implements PageSource {
  constructor(private readonly opts: PlaywrightOptions) {}

  async read(url: string, signal: AbortSignal, onStage?: (stage: ReadStage) => void): Promise<PageRead> {
    onStage?.('opening');
    const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS }).catch((cause) => fail('SOURCE_UNREACHABLE', { cause }));
    // Aborting the job closes the browser, which unwinds any pending Playwright call.
    const onAbort = () => void browser.close().catch(() => {});
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      return await this.readWith(browser, url, signal, onStage);
    } catch (e) {
      if (signal.aborted) return fail('SCRAPE_TIMEOUT', { cause: e });
      if (isAppError(e)) throw e;
      return fail('SOURCE_UNREACHABLE', { cause: e });
    } finally {
      signal.removeEventListener('abort', onAbort);
      await browser.close().catch(() => {});
    }
  }

  private async readWith(browser: Browser, url: string, signal: AbortSignal, onStage?: (s: ReadStage) => void): Promise<PageRead> {
    const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
    const page = await context.newPage();
    await context.route('**/*', (route) => {
      const req = route.request();
      let host: string;
      try {
        host = new URL(req.url()).hostname;
      } catch {
        return route.abort();
      }
      if (BLOCKED_TYPES.has(req.resourceType()) || !hostAllowed(host, this.opts.allowedHosts)) return route.abort();
      return route.continue();
    });
    page.on('dialog', (d) => void d.dismiss().catch(() => {}));
    page.on('popup', (p) => void p.close().catch(() => {}));

    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (new URL(page.url()).hostname !== this.opts.expectedHost) return fail('SOURCE_NOT_PUBLIC');
      if (res && res.status() >= 400) return fail('SOURCE_UNREACHABLE', { details: { httpStatus: res.status() } });
    } catch (cause) {
      if (isAppError(cause) || signal.aborted) throw cause;
      return fail('SOURCE_UNREACHABLE', { cause });
    }

    onStage?.('extracting');
    const deadline = Date.now() + (this.opts.findTimeoutMs ?? 45_000);
    for (let poll = 0; ; poll++) {
      if (signal.aborted) throw signal.reason;
      for (const frame of page.frames()) {
        const hit = await this.inspect(frame);
        if (hit?.tooLarge) return fail('SOURCE_TOO_LARGE');
        if (hit?.data) return { dataText: hit.data, logicText: hit.logic, title: await page.title().catch(() => '') };
      }
      if (Date.now() > deadline) return fail('SOURCE_NO_DATA');
      // A lazily loaded embed may only start once the page has been scrolled.
      if (poll % 4 === 3) await scroll(page);
      await sleep(POLL_MS, signal);
    }
  }

  private inspect(frame: Frame): Promise<FrameHit | null> {
    return frame.evaluate(inspectFrame, MAX_BYTES).catch(() => null);
  }
}

const scroll = (page: Page) => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});

export const GOOGLE_HOSTS = ['google.com', 'gstatic.com', 'googleusercontent.com', 'googleapis.com'] as const;
