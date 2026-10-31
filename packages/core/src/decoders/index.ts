import type { PlanDecoder } from './types';
import { decoderV1 } from './v1';

export type { PlanDecoder } from './types';
export { parseSpecialLabel } from './v1';

/** Oldest first. A new page format adds a decoder here; existing ones are never edited. */
const DECODERS: readonly PlanDecoder[] = [decoderV1];

export function selectDecoder(logicHash: string): { decoder: PlanDecoder; known: boolean } {
  const match = DECODERS.find((d) => d.logicHashes.includes(logicHash));
  if (match) return { decoder: match, known: true };
  return { decoder: DECODERS[DECODERS.length - 1]!, known: false };
}
