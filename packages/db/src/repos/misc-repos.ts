import { eq, sql } from 'drizzle-orm';
import type { Db } from '../client-types';
import { guard } from '../translate';
import { lookupCounts, rateLimits, scraperStatus } from '../schema';

export interface RateResult {
  allowed: boolean;
  retryAfterSec: number;
}

/** Fixed windows in Postgres, keyed by hashed IP or voter id. */
export class RateLimitRepo {
  constructor(private readonly db: Db) {}

  hit(opts: { key: string; limit: number; windowMs: number; now: Date }): Promise<RateResult> {
    return guard(async () => {
      const startMs = Math.floor(opts.now.getTime() / opts.windowMs) * opts.windowMs;
      const [row] = await this.db
        .insert(rateLimits)
        .values({ key: opts.key, windowStart: new Date(startMs), count: 1 })
        .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
        .returning({ count: rateLimits.count });
      const allowed = (row?.count ?? 1) <= opts.limit;
      return { allowed, retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil((startMs + opts.windowMs - opts.now.getTime()) / 1000)) };
    });
  }

  /** Current count in the window without adding to it. */
  peek(opts: { key: string; windowMs: number; now: Date }): Promise<number> {
    return guard(async () => {
      const startMs = Math.floor(opts.now.getTime() / opts.windowMs) * opts.windowMs;
      const [row] = await this.db
        .select({ count: rateLimits.count })
        .from(rateLimits)
        .where(sql`${rateLimits.key} = ${opts.key} and ${rateLimits.windowStart} = ${new Date(startMs).toISOString()}::timestamptz`);
      return row?.count ?? 0;
    });
  }

  /** Drop windows older than a day. Called opportunistically. */
  prune(now: Date): Promise<void> {
    return guard(async () => {
      await this.db.delete(rateLimits).where(sql`${rateLimits.windowStart} < ${new Date(now.getTime() - 24 * 3600_000)}`);
    });
  }
}

export class ScraperStatusRepo {
  constructor(private readonly db: Db) {}

  touch(now: Date): Promise<void> {
    return guard(async () => {
      await this.db
        .insert(scraperStatus)
        .values({ id: 1, lastSeenAt: now })
        .onConflictDoUpdate({ target: scraperStatus.id, set: { lastSeenAt: now } });
    });
  }

  lastSeen(): Promise<Date | null> {
    return guard(async () => {
      const [row] = await this.db.select().from(scraperStatus).where(eq(scraperStatus.id, 1)).limit(1);
      return row?.lastSeenAt ?? null;
    });
  }
}

export type LookupOutcome = 'found' | 'not_found' | 'invalid';

export interface LookupCountRow {
  cohort: string;
  outcome: LookupOutcome;
  today: number;
  week: number;
  total: number;
}

/** Home-page search counters; `day` is a Pakistan date (YYYY-MM-DD). */
export class LookupCountRepo {
  constructor(private readonly db: Db) {}

  add(opts: { day: string; cohort: string; outcome: LookupOutcome }): Promise<void> {
    return guard(async () => {
      await this.db
        .insert(lookupCounts)
        .values({ ...opts, count: 1 })
        .onConflictDoUpdate({ target: [lookupCounts.day, lookupCounts.cohort, lookupCounts.outcome], set: { count: sql`${lookupCounts.count} + 1` } });
    });
  }

  /** Totals per cohort and outcome: today, the last 7 days including today, and all time. */
  summary(today: string): Promise<LookupCountRow[]> {
    return guard(async () => {
      const rows = await this.db
        .select({
          cohort: lookupCounts.cohort,
          outcome: lookupCounts.outcome,
          today: sql<string>`sum(${lookupCounts.count}) filter (where ${lookupCounts.day} = ${today}::date)`,
          week: sql<string>`sum(${lookupCounts.count}) filter (where ${lookupCounts.day} > ${today}::date - 7)`,
          total: sql<string>`sum(${lookupCounts.count})`,
        })
        .from(lookupCounts)
        .groupBy(lookupCounts.cohort, lookupCounts.outcome);
      return rows.map((r) => ({ cohort: r.cohort, outcome: r.outcome, today: Number(r.today ?? 0), week: Number(r.week ?? 0), total: Number(r.total) }));
    });
  }
}
