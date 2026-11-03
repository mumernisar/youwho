import 'server-only';
import { fail } from '@youwho/errors';
import type { Dataset, Repos, ReportRow } from '@youwho/db';
import { ADMIN_SESSION_S, createAdminSession, sessionCookie, tokenMatches } from '../admin-session';
import type { SearchStats } from '../schemas';
import { karachiDay } from './lookup';

const FAIL_LIMIT = 5;
const FAIL_WINDOW_MS = 15 * 60_000;

export class AdminService {
  constructor(private readonly deps: { repos: Repos; adminToken: string; sessionSecret: string; hash(v: string): string; now(): Date }) {}

  /** Five failed attempts from one address within 15 minutes lock the form for the rest of the window. */
  async signIn(token: string, ip: string): Promise<{ cookie: string }> {
    const { repos } = this.deps;
    const now = this.deps.now();
    const key = `admin-fail:${this.deps.hash(`ip:${ip}`)}`;
    const failures = await repos.rateLimits.peek({ key, windowMs: FAIL_WINDOW_MS, now });
    if (failures >= FAIL_LIMIT) {
      const left = FAIL_WINDOW_MS - (now.getTime() % FAIL_WINDOW_MS);
      return fail('RATE_LIMITED', { details: { retryAfterSec: Math.ceil(left / 1000) } });
    }
    if (!tokenMatches(token, this.deps.adminToken)) {
      await repos.rateLimits.hit({ key, limit: FAIL_LIMIT, windowMs: FAIL_WINDOW_MS, now });
      return fail('UNAUTHORIZED', { message: 'That token is not right.' });
    }
    return { cookie: sessionCookie(createAdminSession(this.deps.sessionSecret, now.getTime()), ADMIN_SESSION_S) };
  }

  signOutCookie(): string {
    return sessionCookie('', 0);
  }

  list(): Promise<Dataset[]> {
    return this.deps.repos.datasets.list();
  }

  /** Home-page searches, all cohorts largest first. */
  async searches(): Promise<SearchStats> {
    const rows = await this.deps.repos.lookupCounts.summary(karachiDay(this.deps.now()));
    const stats: SearchStats = { today: 0, week: 0, total: 0, invalid: 0, cohorts: [] };
    const byCohort = new Map<string, SearchStats['cohorts'][number]>();
    for (const r of rows) {
      stats.today += r.today;
      stats.week += r.week;
      stats.total += r.total;
      if (r.outcome === 'invalid') {
        stats.invalid += r.total;
        continue;
      }
      const [intake = '', programme = ''] = r.cohort.split('-');
      const c = byCohort.get(r.cohort) ?? { intake, programme, found: 0, notFound: 0, total: 0 };
      if (r.outcome === 'found') c.found += r.total;
      else c.notFound += r.total;
      c.total += r.total;
      byCohort.set(r.cohort, c);
    }
    stats.cohorts = [...byCohort.values()].sort((a, b) => b.total - a.total || a.intake.localeCompare(b.intake) || a.programme.localeCompare(b.programme));
    return stats;
  }

  reports(slug: string): Promise<ReportRow[]> {
    return this.deps.repos.feedback.listReports(slug);
  }

  /** Hard delete in one transaction; also fails queued jobs for those URLs. */
  async delete(slugs: string[]): Promise<{ deleted: string[] }> {
    return { deleted: await this.deps.repos.datasets.deleteBySlugs(slugs, this.deps.now()) };
  }
}
