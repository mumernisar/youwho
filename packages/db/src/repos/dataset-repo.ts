import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { DecodedPlan } from '@youwho/core';
import type { Db } from '../client';
import { guard } from '../translate';
import { datasets, jobs, seats, students } from '../schema';
import type { Dataset, DatasetFull, SaveResult } from '../types';
import { positionToCols, toDataset, toDatasetFull } from './mappers';

export interface SaveInput {
  sourceUrl: string;
  slug: string; // preferred; a numeric suffix is added when another source already owns it
  label: string;
  plan: DecodedPlan;
  dataHash: string;
  logicHash: string;
  decoderKnown: boolean;
  now: Date;
}

const CHUNK = 2000;

export class DatasetRepo {
  constructor(private readonly db: Db) {}

  list(): Promise<Dataset[]> {
    return guard(async () => {
      const rows = await this.db.select().from(datasets).orderBy(desc(datasets.createdAt));
      return rows.map(toDataset);
    });
  }

  getBySlug(slug: string): Promise<DatasetFull | null> {
    return guard(async () => {
      const [row] = await this.db.select().from(datasets).where(eq(datasets.slug, slug)).limit(1);
      return row ? toDatasetFull(row) : null;
    });
  }

  getBySourceUrl(url: string): Promise<Dataset | null> {
    return guard(async () => {
      const [row] = await this.db.select().from(datasets).where(eq(datasets.sourceUrl, url)).limit(1);
      return row ? toDataset(row) : null;
    });
  }

  /** Create the dataset or replace its students and seats in one transaction. */
  save(input: SaveInput): Promise<SaveResult> {
    return guard(() =>
      this.db.transaction(async (tx) => {
        const [existing] = await tx.select().from(datasets).where(eq(datasets.sourceUrl, input.sourceUrl)).limit(1);
        if (existing && existing.dataHash === input.dataHash) {
          await tx.update(datasets).set({ updatedAt: input.now }).where(eq(datasets.id, existing.id));
          return { datasetId: existing.id, slug: existing.slug, created: false, changed: false, seatsBefore: existing.seatsCount };
        }

        const { plan } = input;
        const roomDims: Record<string, { rows: number; cols: number }> = {};
        for (const [idx, dims] of Object.entries(plan.meta.roomDims)) roomDims[plan.meta.rooms[Number(idx)]!] = dims;
        const meta = { ...plan.meta, roomDims };
        const values = {
          label: input.label,
          stamp: plan.meta.stamp,
          meta,
          dataHash: input.dataHash,
          logicHash: input.logicHash,
          decoderKnown: input.decoderKnown,
          warnings: plan.warnings,
          studentsCount: plan.students.length,
          seatsCount: plan.seats.length,
          updatedAt: input.now,
        };

        let id: string;
        let slug: string;
        if (existing) {
          id = existing.id;
          slug = existing.slug;
          await tx.update(datasets).set(values).where(eq(datasets.id, id));
          await tx.delete(seats).where(eq(seats.datasetId, id));
          await tx.delete(students).where(eq(students.datasetId, id));
        } else {
          slug = await this.freeSlug(tx, input.slug);
          const [row] = await tx
            .insert(datasets)
            .values({ ...values, slug, sourceUrl: input.sourceUrl, createdAt: input.now })
            .returning({ id: datasets.id });
          id = row!.id;
        }

        const studentRows = plan.students.map((s) => ({ datasetId: id, reg: s.reg, name: s.name, homeSection: s.homeSection }));
        for (let i = 0; i < studentRows.length; i += CHUNK) await tx.insert(students).values(studentRows.slice(i, i + CHUNK));

        const seatRows = plan.seats.map((s) => {
          const slot = plan.meta.slots[s.slot]!;
          return {
            datasetId: id,
            reg: s.reg,
            slotKey: slot.key,
            endTime: slot.end,
            course: s.course,
            section: s.section,
            room: plan.meta.rooms[s.room]!,
            ...positionToCols(s.position),
          };
        });
        for (let i = 0; i < seatRows.length; i += CHUNK) await tx.insert(seats).values(seatRows.slice(i, i + CHUNK));

        return { datasetId: id, slug, created: !existing, changed: true, seatsBefore: existing?.seatsCount ?? 0 };
      }),
    );
  }

  /** Hard delete. Cascades remove students, seats, votes and reports; queued jobs for these URLs are failed. */
  deleteBySlugs(slugs: string[], now: Date): Promise<string[]> {
    return guard(() =>
      this.db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: datasets.id, slug: datasets.slug, url: datasets.sourceUrl })
          .from(datasets)
          .where(inArray(datasets.slug, slugs));
        if (rows.length === 0) return [];
        await tx
          .update(jobs)
          .set({ status: 'failed', stage: 'failed', errorCode: 'DATASET_NOT_FOUND', errorMessage: 'That department is not on the board.', finishedAt: now })
          .where(sql`${jobs.sourceUrl} in ${rows.map((r) => r.url)} and ${jobs.status} in ('queued', 'running')`);
        await tx.delete(datasets).where(inArray(datasets.id, rows.map((r) => r.id)));
        return rows.map((r) => r.slug);
      }),
    );
  }

  private async freeSlug(tx: Pick<Db, 'select'>, base: string): Promise<string> {
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      const [hit] = await tx.select({ id: datasets.id }).from(datasets).where(eq(datasets.slug, candidate)).limit(1);
      if (!hit) return candidate;
    }
  }
}
