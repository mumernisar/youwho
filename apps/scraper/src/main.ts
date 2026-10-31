import { createLogger, loadScraperEnv } from '@youwho/config';
import { createPostgresDb } from '@youwho/db/postgres';
import { createRepos } from '@youwho/db';
import { createNotifier } from '@youwho/notify';
import { createServer } from './http/server';
import { createRunner } from './runner';
import { createPageSource } from './sources';

/** Composition root: every dependency is built here and nowhere else. */
async function main(): Promise<void> {
  const env = loadScraperEnv();
  const log = createLogger({ name: 'scraper', level: 'info' });
  const handle = createPostgresDb({ url: env.DATABASE_URL, maxConnections: 2 });
  const repos = createRepos(handle.db);

  const runner = createRunner({
    repos,
    source: createPageSource(env),
    notifier: createNotifier(env, log),
    log,
    limitMs: env.JOB_LIMIT_MS,
    now: () => new Date(),
    exit: (code) => process.exit(code),
  });

  const wake = () => void runner.drain();
  const server = createServer({ secret: env.SCRAPER_SECRET, log, wake });
  await new Promise<void>((resolve) => server.listen(env.PORT, resolve));
  log.info({ port: env.PORT, pageSource: env.PAGE_SOURCE, jobLimitMs: env.JOB_LIMIT_MS }, 'scraper listening');

  await runner.bootSweep();
  wake();

  const stop = () => {
    server.close();
    void handle.close().finally(() => process.exit(0));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

void main();
