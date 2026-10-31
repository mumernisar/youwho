import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { DbHandle } from './client-types';
import * as schema from './schema';

/** Neon WebSocket pool: the web app's driver (supports transactions). */
export function createNeonDb(opts: { url: string; maxConnections?: number }): DbHandle {
  const pool = new Pool({ connectionString: opts.url, max: opts.maxConnections ?? 5 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
