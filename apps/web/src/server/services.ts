import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { createRepos, type DbHandle, type Repos } from '@youwho/db';
import { createDb } from '@youwho/db/client';
import { createLogger, loadWebEnv, type Logger, type WebEnv } from '@youwho/config';
import { DatasetService } from './services/datasets';
import { LookupService } from './services/lookup';
import { RoomService } from './services/rooms';

export interface Services {
  env: WebEnv;
  log: Logger;
  repos: Repos;
  now(): Date;
  hash(value: string): string;
  newId(): string;
  lookup: LookupService;
  rooms: RoomService;
  datasets: DatasetService;
}

/** Composition root: built once per server instance. */
export function createServices(env: WebEnv): Services {
  const log = createLogger({ name: 'web', level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });
  const driver = env.DATABASE_URL.includes('neon.tech') ? 'neon' : 'postgres';
  const handle: DbHandle = createDb({ url: env.DATABASE_URL, driver });
  const repos = createRepos(handle.db);
  const now = () => new Date();
  const hash = (v: string) => createHash('sha256').update(env.HASH_SALT + v).digest('hex');
  const datasets = new DatasetService(repos);
  return {
    env,
    log,
    repos,
    now,
    hash,
    newId: randomUUID,
    datasets,
    lookup: new LookupService(repos, datasets),
    rooms: new RoomService(repos, datasets),
  };
}

const globalForServices = globalThis as unknown as { __youwho?: Services };

/** Memoized on globalThis so dev hot reloads do not leak connection pools. */
export function getServices(): Services {
  return (globalForServices.__youwho ??= createServices(loadWebEnv()));
}
