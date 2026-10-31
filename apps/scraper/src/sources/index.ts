import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScraperEnv } from '@youwho/config';
import { FixturePageSource } from './fixture';
import { GOOGLE_HOSTS, PlaywrightPageSource } from './playwright';
import type { PageSource } from './types';

export type { PageSource, PageRead, ReadStage } from './types';

export function createPageSource(env: ScraperEnv): PageSource {
  if (env.PAGE_SOURCE === 'fixture') {
    const dir = env.FIXTURE_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/core/fixtures');
    return new FixturePageSource({ dir, delayMs: env.FIXTURE_DELAY_MS });
  }
  return env.DEV_ALLOW_LOCALHOST
    ? new PlaywrightPageSource({ allowedHosts: ['localhost', ...GOOGLE_HOSTS], expectedHost: 'localhost' })
    : new PlaywrightPageSource({ allowedHosts: GOOGLE_HOSTS, expectedHost: 'sites.google.com' });
}
