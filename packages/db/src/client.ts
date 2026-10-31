import { Pool } from '@neondatabase/serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbDriver = 'neon' | 'postgres';

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
}

/** Web uses the Neon WebSocket pool (supports transactions); the scraper uses postgres.js. */
export function createDb(opts: { url: string; driver: DbDriver; maxConnections?: number }): DbHandle {
  if (opts.driver === 'neon') {
    const pool = new Pool({ connectionString: opts.url, max: opts.maxConnections ?? 5 });
    return { db: drizzleNeon(pool, { schema }), close: () => pool.end() };
  }
  const sql = postgres(opts.url, { max: opts.maxConnections ?? 2, onnotice: () => {} });
  return { db: drizzlePostgres(sql, { schema }), close: () => sql.end() };
}
