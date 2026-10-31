import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Apply the SQL migrations in packages/db/migrations. Uses plain TCP, which Neon accepts. */
export async function migrateDb(url: string, folder: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: folder });
  } finally {
    await sql.end();
  }
}
