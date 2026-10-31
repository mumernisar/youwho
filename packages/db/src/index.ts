import type { Db } from './client.js';
import { DatasetRepo } from './repos/dataset-repo.js';
import { FeedbackRepo } from './repos/feedback-repo.js';
import { JobRepo } from './repos/job-repo.js';
import { RateLimitRepo, ScraperStatusRepo } from './repos/misc-repos.js';
import { SeatRepo } from './repos/seat-repo.js';

export * from './client.js';
export * from './types.js';
export * from './migrate.js';
export { guard } from './translate.js';
export { DatasetRepo, type SaveInput } from './repos/dataset-repo.js';
export { SeatRepo } from './repos/seat-repo.js';
export { JobRepo, type Job } from './repos/job-repo.js';
export { FeedbackRepo, type ReportReason, type ReportRow } from './repos/feedback-repo.js';
export { RateLimitRepo, ScraperStatusRepo, type RateResult } from './repos/misc-repos.js';

export interface Repos {
  datasets: DatasetRepo;
  seats: SeatRepo;
  jobs: JobRepo;
  feedback: FeedbackRepo;
  rateLimits: RateLimitRepo;
  scraperStatus: ScraperStatusRepo;
}

export const createRepos = (db: Db): Repos => ({
  datasets: new DatasetRepo(db),
  seats: new SeatRepo(db),
  jobs: new JobRepo(db),
  feedback: new FeedbackRepo(db),
  rateLimits: new RateLimitRepo(db),
  scraperStatus: new ScraperStatusRepo(db),
});
