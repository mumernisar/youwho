import { and, asc, count, eq, lt, sql } from 'drizzle-orm';
import type { Db } from '../client-types';
import { guard, isUniqueViolation } from '../translate';
import { jobs } from '../schema';

export interface Job {
  id: string;
  sourceUrl: string;
  kind: 'add' | 'refresh';
  datasetId: string | null;
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  finishedAt: Date | null;
}

const toJob = (r: typeof jobs.$inferSelect): Job => ({
  id: r.id,
  sourceUrl: r.sourceUrl,
  kind: r.kind,
  datasetId: r.datasetId,
  status: r.status,
  stage: r.stage,
  errorCode: r.errorCode,
  errorMessage: r.errorMessage,
  createdAt: r.createdAt,
  startedAt: r.startedAt,
  heartbeatAt: r.heartbeatAt,
  finishedAt: r.finishedAt,
});

const ACTIVE = sql`${jobs.status} in ('queued', 'running')`;

export class JobRepo {
  constructor(private readonly db: Db) {}

  get(id: string): Promise<Job | null> {
    return guard(async () => {
      const [row] = await this.db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
      return row ? toJob(row) : null;
    });
  }

  /** Insert a job, or join the active job for the same URL when the unique index says one exists. */
  createOrJoin(input: { sourceUrl: string; kind: 'add' | 'refresh'; datasetId: string | null; requesterHash: string; now: Date }): Promise<{ job: Job; joined: boolean }> {
    return guard(async () => {
      try {
        const [row] = await this.db
          .insert(jobs)
          .values({ sourceUrl: input.sourceUrl, kind: input.kind, datasetId: input.datasetId, requesterHash: input.requesterHash, createdAt: input.now })
          .returning();
        return { job: toJob(row!), joined: false };
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        const [row] = await this.db.select().from(jobs).where(and(eq(jobs.sourceUrl, input.sourceUrl), ACTIVE)).limit(1);
        if (!row) throw e;
        return { job: toJob(row), joined: true };
      }
    });
  }

  /** Oldest queued job becomes running. Safe against two runners claiming at once. */
  claim(now: Date): Promise<Job | null> {
    return guard(async () => {
      const result = await this.db.execute(sql`
        update jobs set status = 'running', stage = 'opening', started_at = ${now.toISOString()}::timestamptz, heartbeat_at = ${now.toISOString()}::timestamptz
        where id = (select id from jobs where status = 'queued' order by created_at limit 1 for update skip locked)
        returning id`);
      const id = (result as unknown as { id: string }[] | { rows: { id: string }[] });
      const first = Array.isArray(id) ? id[0] : id.rows[0];
      return first ? this.get(first.id) : null;
    });
  }

  setStage(id: string, stage: string, now: Date): Promise<void> {
    return guard(async () => {
      await this.db.update(jobs).set({ stage, heartbeatAt: now }).where(and(eq(jobs.id, id), eq(jobs.status, 'running')));
    });
  }

  finishDone(id: string, datasetId: string, now: Date): Promise<boolean> {
    return guard(async () => {
      const rows = await this.db
        .update(jobs)
        .set({ status: 'done', stage: 'done', datasetId, finishedAt: now })
        .where(and(eq(jobs.id, id), eq(jobs.status, 'running')))
        .returning({ id: jobs.id });
      return rows.length > 0;
    });
  }

  /** Only a running or queued job can fail, so a late write never overwrites a sweep. */
  fail(id: string, e: { code: string; message: string }, now: Date, from: 'running' | 'queued' = 'running'): Promise<boolean> {
    return guard(async () => {
      const rows = await this.db
        .update(jobs)
        .set({ status: 'failed', stage: 'failed', errorCode: e.code, errorMessage: e.message, finishedAt: now })
        .where(and(eq(jobs.id, id), eq(jobs.status, from)))
        .returning({ id: jobs.id });
      return rows.length > 0;
    });
  }

  /** Boot sweep: any running job belongs to a dead process. */
  failAllRunning(e: { code: string; message: string }, now: Date): Promise<number> {
    return guard(async () => {
      const rows = await this.db
        .update(jobs)
        .set({ status: 'failed', stage: 'failed', errorCode: e.code, errorMessage: e.message, finishedAt: now })
        .where(eq(jobs.status, 'running'))
        .returning({ id: jobs.id });
      return rows.length;
    });
  }

  /** Jobs ahead of this one: queued jobs created earlier, plus one when something is running. */
  position(job: Job): Promise<number> {
    return guard(async () => {
      const [q] = await this.db.select({ n: count() }).from(jobs).where(and(eq(jobs.status, 'queued'), lt(jobs.createdAt, job.createdAt)));
      const [r] = await this.db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'running'));
      return (q?.n ?? 0) + ((r?.n ?? 0) > 0 ? 1 : 0);
    });
  }

  countQueued(): Promise<number> {
    return guard(async () => {
      const [row] = await this.db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'queued'));
      return row?.n ?? 0;
    });
  }

  hasQueued(): Promise<boolean> {
    return guard(async () => {
      const rows = await this.db.select({ id: jobs.id }).from(jobs).where(eq(jobs.status, 'queued')).orderBy(asc(jobs.createdAt)).limit(1);
      return rows.length > 0;
    });
  }

  lastFinishedRefresh(datasetId: string): Promise<Date | null> {
    return guard(async () => {
      const [row] = await this.db
        .select({ at: jobs.finishedAt })
        .from(jobs)
        .where(and(eq(jobs.datasetId, datasetId), eq(jobs.status, 'done'), eq(jobs.kind, 'refresh')))
        .orderBy(sql`${jobs.finishedAt} desc`)
        .limit(1);
      return row?.at ?? null;
    });
  }
}
