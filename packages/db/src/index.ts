import type { Db } from './client-types';
import { DatasetRepo } from './repos/dataset-repo';
import { FeedbackRepo } from './repos/feedback-repo';
import { JobRepo } from './repos/job-repo';
import { LookupCountRepo, RateLimitRepo, ScraperStatusRepo } from './repos/misc-repos';
import { SeatRepo } from './repos/seat-repo';

export type { Db, DbDriver, DbHandle } from './client-types';
export * from './types';
export * from './migrate';
export { guard } from './translate';
export { DatasetRepo, type SaveInput } from './repos/dataset-repo';
export { SeatRepo } from './repos/seat-repo';
export { JobRepo, type Job } from './repos/job-repo';
export { FeedbackRepo, type ReportReason, type ReportRow } from './repos/feedback-repo';
export { LookupCountRepo, RateLimitRepo, ScraperStatusRepo, type LookupCountRow, type LookupOutcome, type RateResult } from './repos/misc-repos';

export interface Repos {
  datasets: DatasetRepo;
  seats: SeatRepo;
  jobs: JobRepo;
  feedback: FeedbackRepo;
  rateLimits: RateLimitRepo;
  scraperStatus: ScraperStatusRepo;
  lookupCounts: LookupCountRepo;
}

export const createRepos = (db: Db): Repos => ({
  datasets: new DatasetRepo(db),
  seats: new SeatRepo(db),
  jobs: new JobRepo(db),
  feedback: new FeedbackRepo(db),
  rateLimits: new RateLimitRepo(db),
  scraperStatus: new ScraperStatusRepo(db),
  lookupCounts: new LookupCountRepo(db),
});
