import 'server-only';
import type { Logger } from '@youwho/config';

/** The web app's only way to reach the scraper. Failures are logged and never fail a request. */
export interface ScraperClient {
  /** Tell the scraper there is work. Returns false when it could not be reached (the job stays queued). */
  kick(): Promise<boolean>;
  /** Ping /health so a sleeping instance starts waking. Fire-and-forget. */
  wake(): Promise<void>;
}

export function createScraperClient(env: { SCRAPER_URL: string; SCRAPER_SECRET: string }, log: Logger): ScraperClient {
  const base = env.SCRAPER_URL.replace(/\/$/, '');
  return {
    async kick() {
      try {
        const res = await fetch(`${base}/kick`, {
          method: 'POST',
          headers: { authorization: `Bearer ${env.SCRAPER_SECRET}` },
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new TypeError(`scraper answered ${res.status}`);
        return true;
      } catch (err) {
        log.warn({ code: 'SCRAPER_UNAVAILABLE', err }, 'kick failed; job stays queued');
        return false;
      }
    },
    async wake() {
      // A cold Render instance takes up to a minute to answer. The request is enough to start it.
      await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) }).catch(() => {});
    },
  };
}
