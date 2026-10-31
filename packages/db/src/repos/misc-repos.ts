import { eq, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { guard } from '../translate';
import { rateLimits, scraperStatus } from '../schema';

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
