import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbDriver = 'neon' | 'postgres';

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}
