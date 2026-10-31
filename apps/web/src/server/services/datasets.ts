import 'server-only';
import { fail } from '@youwho/errors';
import type { Dataset, Repos } from '@youwho/db';
import type { DatasetSummary, DepartmentView } from '../schemas';

export const toSummary = (d: Dataset, confirmed: ReadonlySet<string>): DatasetSummary => ({
  slug: d.slug,
  label: d.label,
  sourceUrl: d.sourceUrl,
  stamp: d.stamp,
  students: d.students,
  seats: d.seats,
  confirms: d.confirms,
  reports: d.reports,
  updatedAt: d.updatedAt,
  viewerConfirmed: confirmed.has(d.slug),
});

export class DatasetService {
  constructor(private readonly repos: Repos) {}

  /** Slugs the viewer has confirmed; empty for a first-time visitor. */
  async confirmedFor(voterHash: string | null): Promise<ReadonlySet<string>> {
    return voterHash ? this.repos.feedback.confirmedSlugs(voterHash) : new Set();
  }

  async list(voterHash: string | null): Promise<DatasetSummary[]> {
    const [all, confirmed] = await Promise.all([this.repos.datasets.list(), this.confirmedFor(voterHash)]);
    return all.map((d) => toSummary(d, confirmed));
  }

  async department(slug: string, voterHash: string | null): Promise<DepartmentView> {
    const full = await this.repos.datasets.getBySlug(slug);
    if (!full) return fail('DATASET_NOT_FOUND', { details: { slug } });
    const [rooms, confirmed] = await Promise.all([this.repos.seats.rooms(full.id), this.confirmedFor(voterHash)]);
    return { dataset: toSummary(full, confirmed), warnings: full.warnings, rooms };
  }
}
