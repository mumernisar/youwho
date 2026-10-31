import type { RawPlan } from '../schema.js';
import type { DecodedPlan } from '../types.js';

export interface PlanDecoder {
  version: string; // "v1"
  logicHashes: readonly string[]; // page scripts this decoder was written against
  decode(raw: RawPlan): DecodedPlan;
}
