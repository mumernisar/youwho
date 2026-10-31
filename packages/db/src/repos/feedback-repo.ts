import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { fail } from '@youwho/errors';
import type { Db } from '../client';
import { guard } from '../translate';
import { confirmations, datasets, reports } from '../schema';

export type ReportReason = 'wrong_source' | 'outdated' | 'wrong_data' | 'other';

export interface ReportRow {
  id: string;
  reason: ReportReason;
  note: string | null;
  createdAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class FeedbackRepo {
  constructor(private readonly db: Db) {}

  /** Toggle; the row and the counter change in one transaction. */
  toggleConfirm(slug: string, voterHash: string, now: Date): Promise<{ confirmed: boolean; count: number }> {
    return guard(() =>
      this.db.transaction(async (tx) => {
        const [ds] = await tx.select({ id: datasets.id }).from(datasets).where(eq(datasets.slug, slug)).limit(1);
        if (!ds) return fail('DATASET_NOT_FOUND', { details: { slug } });
        const removed = await tx
          .delete(confirmations)
          .where(and(eq(confirmations.datasetId, ds.id), eq(confirmations.voterHash, voterHash)))
          .returning({ v: confirmations.voterHash });
        const delta = removed.length > 0 ? -1 : 1;
        if (delta === 1) {
          await tx.insert(confirmations).values({ datasetId: ds.id, voterHash, createdAt: now }).onConflictDoNothing();
        }
        const [row] = await tx
          .update(datasets)
          .set({ confirmCount: sql`greatest(${datasets.confirmCount} + ${delta}, 0)` })
          .where(eq(datasets.id, ds.id))
          .returning({ count: datasets.confirmCount });
        return { confirmed: delta === 1, count: row!.count };
      }),
    );
  }

  /** Slugs this voter has confirmed, so the board can show their state. */
  confirmedSlugs(voterHash: string): Promise<Set<string>> {
    return guard(async () => {
      const rows = await this.db
        .select({ slug: datasets.slug })
        .from(confirmations)
        .innerJoin(datasets, eq(datasets.id, confirmations.datasetId))
        .where(eq(confirmations.voterHash, voterHash));
      return new Set(rows.map((r) => r.slug));
    });
  }

  /** One report per voter per dataset per day: a second one inside a day replaces the first. */
  report(input: { slug: string; voterHash: string; reason: ReportReason; note: string | null; now: Date }) {
    return guard(() =>
      this.db.transaction(async (tx) => {
        const [ds] = await tx.select().from(datasets).where(eq(datasets.slug, input.slug)).limit(1);
        if (!ds) return fail('DATASET_NOT_FOUND', { details: { slug: input.slug } });
        const since = new Date(input.now.getTime() - DAY_MS);
        const [prior] = await tx
          .select({ id: reports.id })
          .from(reports)
          .where(and(eq(reports.datasetId, ds.id), eq(reports.voterHash, input.voterHash), gt(reports.createdAt, since)))
          .limit(1);
        if (prior) {
          await tx.update(reports).set({ reason: input.reason, note: input.note, createdAt: input.now }).where(eq(reports.id, prior.id));
          return { reportId: prior.id, dataset: { slug: ds.slug, label: ds.label, sourceUrl: ds.sourceUrl }, reports: ds.reportCount, confirms: ds.confirmCount };
        }
        const [row] = await tx
          .insert(reports)
          .values({ datasetId: ds.id, reason: input.reason, note: input.note, voterHash: input.voterHash, createdAt: input.now })
          .returning({ id: reports.id });
        const [upd] = await tx
          .update(datasets)
          .set({ reportCount: sql`${datasets.reportCount} + 1` })
          .where(eq(datasets.id, ds.id))
          .returning({ reports: datasets.reportCount });
        return { reportId: row!.id, dataset: { slug: ds.slug, label: ds.label, sourceUrl: ds.sourceUrl }, reports: upd!.reports, confirms: ds.confirmCount };
      }),
    );
  }

  listReports(slug: string): Promise<ReportRow[]> {
    return guard(async () => {
      const rows = await this.db
        .select({ id: reports.id, reason: reports.reason, note: reports.note, createdAt: reports.createdAt })
        .from(reports)
        .innerJoin(datasets, eq(datasets.id, reports.datasetId))
        .where(eq(datasets.slug, slug))
        .orderBy(desc(reports.createdAt));
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    });
  }
}
