import 'server-only';
import { fail } from '@youwho/errors';
import { parseReg } from '@youwho/core';
import type { Repos } from '@youwho/db';
import type { LookupView } from '../schemas';
import { toSummary, type DatasetService } from './datasets';

export class LookupService {
  constructor(
    private readonly repos: Repos,
    private readonly datasets: DatasetService,
  ) {}

  async lookup(input: string, voterHash: string | null): Promise<LookupView> {
    const reg = parseReg(input);
    const [result, confirmed] = await Promise.all([this.repos.seats.lookup(reg), this.datasets.confirmedFor(voterHash)]);
    if (!result) return fail('STUDENT_NOT_FOUND');
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
