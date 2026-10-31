import 'server-only';
import type { Repos, ReportReason } from '@youwho/db';
import type { Notifier } from '@youwho/notify';

const REASON_TEXT: Record<ReportReason, string> = {
  wrong_source: 'Wrong source page',
  outdated: 'Out of date',
  wrong_data: 'Seats look wrong',
  other: 'Something else',
};

export class FeedbackService {
  constructor(private readonly deps: { repos: Repos; notifier: Notifier; now(): Date }) {}

  /** Toggle. The row and the counter change in one transaction. */
  confirm(slug: string, voterHash: string): Promise<{ confirmed: boolean; count: number }> {
    return this.deps.repos.feedback.toggleConfirm(slug, voterHash, this.deps.now());
  }

  /** One report per voter per dataset per day. A new one emails the owner; an edit does not. */
  async report(input: { slug: string; reason: ReportReason; note?: string | undefined; voterHash: string }): Promise<{ reportId: string }> {
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
}
