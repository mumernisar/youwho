import 'server-only';
import { fail } from '@youwho/errors';
import type { Repos, ReportReason } from '@youwho/db';
import type { Notifier } from '@youwho/notify';

/**
 * Per network address, per department, per day. Clearing cookies gives a new voter id, so these
 * stop one device stacking votes. They are caps rather than one-per-IP because a campus wifi or a
 * mobile carrier puts many students behind the same address.
 */
export const IP_LIMITS = {
  confirmsPerDay: 5,
  reportsPerDay: 3,
} as const;
const DAY_MS = 24 * 3600_000;

const REASON_TEXT: Record<ReportReason, string> = {
  wrong_source: 'Wrong source page',
  outdated: 'Out of date',
  wrong_data: 'Seats look wrong',
  other: 'Something else',
};

export class FeedbackService {
  constructor(private readonly deps: { repos: Repos; notifier: Notifier; now(): Date }) {}

  /** Toggle. The row and the counter change in one transaction. Only adding a confirm counts towards the address cap. */
  async confirm(slug: string, voterHash: string, ipHash: string): Promise<{ confirmed: boolean; count: number }> {
    const adding = !(await this.deps.repos.feedback.confirmedSlugs(voterHash)).has(slug);
    if (adding) await this.perAddress('confirm', slug, ipHash, IP_LIMITS.confirmsPerDay);
    return this.deps.repos.feedback.toggleConfirm(slug, voterHash, this.deps.now());
  }

  /** One report per voter per dataset per day. A new one emails the owner; an edit does not. */
  async report(input: { slug: string; reason: ReportReason; note?: string | undefined; voterHash: string; ipHash: string }): Promise<{ reportId: string }> {
    await this.perAddress('report', input.slug, input.ipHash, IP_LIMITS.reportsPerDay);
    const r = await this.deps.repos.feedback.report({
      slug: input.slug,
      voterHash: input.voterHash,
      reason: input.reason,
      note: input.note ? input.note : null,
      now: this.deps.now(),
    });
    if (r.isNew) {
      await this.deps.notifier.send({
        type: 'dataset.reported',
        slug: r.dataset.slug,
        label: r.dataset.label,
        sourceUrl: r.dataset.sourceUrl,
        reason: REASON_TEXT[input.reason],
        ...(input.note ? { note: input.note } : {}),
        reports: r.reports,
        confirms: r.confirms,
      });
    }
    return { reportId: r.reportId };
  }

  private async perAddress(kind: 'confirm' | 'report', slug: string, ipHash: string, limit: number): Promise<void> {
    const r = await this.deps.repos.rateLimits.hit({ key: `${kind}-ip:${slug}:${ipHash}`, limit, windowMs: DAY_MS, now: this.deps.now() });
    if (!r.allowed) fail('RATE_LIMITED', { details: { retryAfterSec: r.retryAfterSec } });
  }
}
