import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScraperEnv } from '@youwho/config';
import { FixturePageSource } from './fixture';
import { GOOGLE_HOSTS, PlaywrightPageSource } from './playwright';
import type { PageSource } from './types';

export type { PageSource, PageRead, ReadStage } from './types';

/**
 * The repo's sample files. Searched upward because this file runs from two depths: src/sources under
 * `tsx watch`, and dist once bundled.
 */
function findFixtureDir(): string {
  const start = path.dirname(fileURLToPath(import.meta.url));
  for (let dir = start; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'packages/core/fixtures');
    if (existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return path.resolve(start, '../../../packages/core/fixtures');
  }
}

export function createPageSource(env: ScraperEnv): PageSource {
  if (env.PAGE_SOURCE === 'fixture') {
    const dir = env.FIXTURE_DIR ?? findFixtureDir();
    return new FixturePageSource({ dir, delayMs: env.FIXTURE_DELAY_MS });
  }
  return env.DEV_ALLOW_LOCALHOST
    ? new PlaywrightPageSource({ allowedHosts: ['localhost', ...GOOGLE_HOSTS], expectedHost: 'localhost' })
    : new PlaywrightPageSource({ allowedHosts: GOOGLE_HOSTS, expectedHost: 'sites.google.com' });
}
