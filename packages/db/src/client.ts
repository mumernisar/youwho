import type { DbDriver, DbHandle } from './client-types';
import { createNeonDb } from './neon';
import { createPostgresDb } from './postgres';

export type { Db, DbDriver, DbHandle } from './client-types';
export { createNeonDb, createPostgresDb };

export function createDb(opts: { url: string; driver: DbDriver; maxConnections?: number }): DbHandle {
  const { driver, ...rest } = opts;
  return driver === 'neon' ? createNeonDb(rest) : createPostgresDb(rest);
}
