import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { DbHandle } from './client-types';
import * as schema from './schema';

/** postgres.js: the scraper's driver, and local development. */
export function createPostgresDb(opts: { url: string; maxConnections?: number }): DbHandle {
  const sql = postgres(opts.url, { max: opts.maxConnections ?? 2, onnotice: () => {} });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}
