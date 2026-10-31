import 'server-only';
import { fail } from '@youwho/errors';
import type { Dataset, Repos, ReportRow } from '@youwho/db';
import { ADMIN_SESSION_S, createAdminSession, sessionCookie, tokenMatches } from '../admin-session';

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

  reports(slug: string): Promise<ReportRow[]> {
    return this.deps.repos.feedback.listReports(slug);
  }

  /** Hard delete in one transaction; also fails queued jobs for those URLs. */
  async delete(slugs: string[]): Promise<{ deleted: string[] }> {
    return { deleted: await this.deps.repos.datasets.deleteBySlugs(slugs, this.deps.now()) };
  }
}
