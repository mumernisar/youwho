import { createHash } from 'node:crypto';
import { fail } from '@youwho/errors';
import { parseRawPlan, selectDecoder, slugFromSourceUrl, type DecodedPlan } from '@youwho/core';
import type { DatasetRepo, SaveResult } from '@youwho/db';
import type { PageRead } from '../sources';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface Decoded {
  plan: DecodedPlan;
  dataHash: string;
  logicHash: string;
  decoderKnown: boolean;
}

/** decode: text → DecodedPlan. Shape and type checks only. */
export function decodeStep(read: PageRead): Decoded {
  const raw = parseRawPlan(read.dataText);
  // The page's own decoder script, whitespace removed, picks the decoder version.
  const logicHash = sha256(read.logicText.replace(/\s+/g, ''));
  const { decoder, known } = selectDecoder(logicHash);
  return { plan: decoder.decode(raw), dataHash: sha256(read.dataText), logicHash, decoderKnown: known };
}

export interface PersistInput {
  sourceUrl: string;
  title: string;
  decoded: Decoded;
  existingLabel: string | null;
  now: Date;
}

/** persist: plan → dataset id and changed flag. One transaction; a refresh keeps the existing label. */
export function persistStep(datasets: DatasetRepo, input: PersistInput): Promise<SaveResult> {
  const slug = slugFromSourceUrl(input.sourceUrl);
  const label = input.existingLabel ?? (input.title.trim().slice(0, 120) || slug) ;
  if (input.decoded.plan.students.length === 0) fail('DATA_SHAPE_INVALID', { details: { issues: [{ path: 'groups', message: 'no students found' }] } });
  return datasets.save({
    sourceUrl: input.sourceUrl,
    slug,
    label,
    plan: input.decoded.plan,
    dataHash: input.decoded.dataHash,
    logicHash: input.decoded.logicHash,
    decoderKnown: input.decoded.decoderKnown,
    now: input.now,
  });
}
