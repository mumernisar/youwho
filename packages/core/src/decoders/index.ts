import type { PlanDecoder } from './types.js';
import { decoderV1 } from './v1.js';

export type { PlanDecoder } from './types.js';
export { parseSpecialLabel } from './v1.js';

/** Oldest first. A new page format adds a decoder here; existing ones are never edited. */
const DECODERS: readonly PlanDecoder[] = [decoderV1];

export function selectDecoder(logicHash: string): { decoder: PlanDecoder; known: boolean } {
  const match = DECODERS.find((d) => d.logicHashes.includes(logicHash));
  if (match) return { decoder: match, known: true };
  return { decoder: DECODERS[DECODERS.length - 1]!, known: false };
}
