import type { DbDriver } from '@youwho/db';

/** Scripts target local Postgres by default; pass --neon to target NEON_DATABASE_URL. */
export function scriptDb(): { url: string; driver: DbDriver; target: string } {
  const neon = process.argv.includes('--neon');
  const url = neon ? process.env.NEON_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) {
    console.error(`${neon ? 'NEON_DATABASE_URL' : 'DATABASE_URL'} is not set (see .env.example)`);
    process.exit(1);
  }
  return { url, driver: neon ? 'neon' : 'postgres', target: neon ? 'neon' : 'local' };
}
