import 'server-only';
import { fail } from '@youwho/errors';
import { cohortOf, normalizeReg, parseReg } from '@youwho/core';
import type { LookupOutcome, Repos } from '@youwho/db';
import type { Defer } from '../background';
import type { LookupView } from '../schemas';
import { toSummary, type DatasetService } from './datasets';

/** Pakistan date (YYYY-MM-DD); the country is UTC+5 all year. */
export const karachiDay = (now: Date) => new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

export class LookupService {
  constructor(private readonly deps: { repos: Repos; datasets: DatasetService; defer: Defer; now(): Date }) {}

  async lookup(input: string, voterHash: string | null): Promise<LookupView> {
    return (await this.find(parseReg(input), voterHash)) ?? fail('STUDENT_NOT_FOUND');
  }

  /** The home-page search: same answer as lookup, and counted once the response has gone out. */
  async search(input: string, voterHash: string | null): Promise<LookupView> {
    const reg = normalizeReg(input);
    if (!reg) {
      this.count('', 'invalid');
      return fail('INVALID_REG_NUMBER');
    }
    const view = await this.find(reg, voterHash);
    this.count(cohortOf(reg), view ? 'found' : 'not_found');
    return view ?? fail('STUDENT_NOT_FOUND');
  }

  private count(cohort: string, outcome: LookupOutcome): void {
    const day = karachiDay(this.deps.now());
    this.deps.defer('count-lookup', () => this.deps.repos.lookupCounts.add({ day, cohort, outcome }));
  }

  private async find(reg: string, voterHash: string | null): Promise<LookupView | null> {
    const [result, confirmed] = await Promise.all([this.deps.repos.seats.lookup(reg), this.deps.datasets.confirmedFor(voterHash)]);
    if (!result) return null;
    return {
      reg: result.reg,
      name: result.name,
      departments: result.departments.map((d) => ({
        dataset: toSummary(d.dataset, confirmed),
        papers: d.papers,
        tba: d.tba,
      })),
    };
  }
}
