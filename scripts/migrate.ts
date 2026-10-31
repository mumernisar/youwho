import { fileURLToPath } from 'node:url';
import { migrateDb } from '@youwho/db';
import { scriptDb } from './db-url';

const { url, target } = scriptDb();
await migrateDb(url, fileURLToPath(new URL('../packages/db/migrations', import.meta.url)));
console.log(`migrations applied (${target})`);
