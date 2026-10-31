import type { RawPlan } from '../schema';
import type { DecodedPlan } from '../types';

export interface PlanDecoder {
  version: string; // "v1"
  logicHashes: readonly string[]; // page scripts this decoder was written against
  decode(raw: RawPlan): DecodedPlan;
}
