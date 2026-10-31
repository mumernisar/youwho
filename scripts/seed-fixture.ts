import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseRawPlan, selectDecoder, slugFromSourceUrl } from '@youwho/core';
import { DatasetRepo } from '@youwho/db';
import { createDb } from '@youwho/db/client';
import { scriptDb } from './db-url';

const dir = fileURLToPath(new URL('../packages/core/fixtures/', import.meta.url));
const text = readFileSync(dir + 'cs-fa26-mid.json', 'utf8');
const logic = readFileSync(dir + 'cs-fa26-mid.logic.js', 'utf8');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const logicHash = sha(logic.replace(/\s+/g, ''));
const { decoder, known } = selectDecoder(logicHash);
const plan = decoder.decode(parseRawPlan(text));

const sourceUrl = 'https://sites.google.com/view/cs-mid-term-fa26-students';
const { url, driver, target } = scriptDb();
const handle = createDb({ url, driver });
try {
  const result = await new DatasetRepo(handle.db).save({
    sourceUrl,
    slug: slugFromSourceUrl(sourceUrl),
    label: 'Computer Science · Mid-terms FA26',
    plan,
    dataHash: sha(text),
    logicHash,
    decoderKnown: known,
    now: new Date(),
  });
  console.log(`seeded (${target}):`, result, `${plan.students.length} students, ${plan.seats.length} seats`);
} finally {
  await handle.close();
}
