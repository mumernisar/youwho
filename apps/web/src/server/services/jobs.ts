import 'server-only';
import { AppError, ERRORS, fail, type ErrorCode } from '@youwho/errors';
import { canonicalizeSourceUrl } from '@youwho/core';
import type { Job, Repos } from '@youwho/db';
import type { DatasetSummary, JobView } from '../schemas';
import type { ScraperClient } from '../scraper-client';
import { toSummary, type DatasetService } from './datasets';

export const LIMITS = {
  jobsPerRequesterPerHour: 3,
  queuedTotal: 20,
  refreshCooldownMs: 10 * 60_000,
  runningStallMs: 4 * 60_000,
  queuedStaleMs: 15 * 60_000,
  /** A queued job whose scraper has not answered at all (still "waking") fails sooner than one waiting in line. */
  wakeTimeoutMs: 2 * 60_000,
  kickEveryMs: 15_000,
  scraperSeenMs: 30_000,
} as const;

export type SubmitResult = { job: JobView } | { dataset: DatasetSummary };

export class JobService {
  /** Last re-kick per job, on this server instance, so polling cannot flood the scraper. */
  private readonly lastKick = new Map<string, number>();

  constructor(
    private readonly deps: {
      repos: Repos;
      datasets: DatasetService;
      scraper: ScraperClient;
      now(): Date;
    },
  ) {}

  async submit(input: { url: string; kind?: 'add' | 'refresh' | undefined; requesterHash: string }, voterHash: string | null): Promise<SubmitResult> {
    const { repos, scraper } = this.deps;
    const now = this.deps.now();
    const url = canonicalizeSourceUrl(input.url);
    const existing = await repos.datasets.getBySourceUrl(url);
    const wantsRefresh = input.kind === 'refresh' && existing !== null;

    // Adding something already on the board is not a job: show the department.
    if (existing && !wantsRefresh) return { dataset: toSummary(existing, await this.deps.datasets.confirmedFor(voterHash)) };

    // A URL with an active job returns that job, without using up any limit.
    const active = await repos.jobs.findActive(url);
    if (active) return { job: await this.view(active) };

    if (existing) {
      const wait = new Date(existing.updatedAt).getTime() + LIMITS.refreshCooldownMs - now.getTime();
      if (wait > 0) fail('REFRESH_COOLDOWN', { details: { retryAfterSec: Math.ceil(wait / 1000) } });
    }
    if ((await repos.jobs.countQueued()) >= LIMITS.queuedTotal) fail('QUEUE_FULL');
    const rate = await repos.rateLimits.hit({ key: `jobs:${input.requesterHash}`, limit: LIMITS.jobsPerRequesterPerHour, windowMs: 3600_000, now });
    if (!rate.allowed) fail('RATE_LIMITED', { details: { retryAfterSec: rate.retryAfterSec } });

    const { job } = await repos.jobs.createOrJoin({ sourceUrl: url, kind: existing ? 'refresh' : 'add', datasetId: existing?.id ?? null, requesterHash: input.requesterHash, now });
    this.lastKick.set(job.id, now.getTime());
    await scraper.kick();
    return { job: await this.view(job) };
  }

  /** Status for the poller. Also fails jobs whose scraper died without restarting. */
  async status(id: string): Promise<JobView> {
    const { repos, scraper } = this.deps;
    let job = await repos.jobs.get(id);
    if (!job) return fail('JOB_NOT_FOUND');
    const now = this.deps.now();

    const age = now.getTime() - job.createdAt.getTime();
    if (job.status === 'running' && job.heartbeatAt && now.getTime() - job.heartbeatAt.getTime() > LIMITS.runningStallMs) {
      await repos.jobs.fail(id, { code: 'SCRAPER_STALLED', message: ERRORS.SCRAPER_STALLED.message }, now, 'running');
      job = (await repos.jobs.get(id)) ?? job;
    } else if (job.status === 'queued' && (age > LIMITS.queuedStaleMs || (age > LIMITS.wakeTimeoutMs && (await this.waking(now))))) {
      await repos.jobs.fail(id, { code: 'SCRAPER_UNAVAILABLE', message: ERRORS.SCRAPER_UNAVAILABLE.message }, now, 'queued');
      job = (await repos.jobs.get(id)) ?? job;
    } else if (job.status === 'queued') {
      const last = this.lastKick.get(id) ?? 0;
      if (now.getTime() - last >= LIMITS.kickEveryMs) {
        this.lastKick.set(id, now.getTime());
        void scraper.kick();
      }
    }
    if (job.status === 'done' || job.status === 'failed') this.lastKick.delete(id);
    return this.view(job);
  }

  /** The scraper has not reported in recently: asleep, starting, or not reachable from here. */
  private async waking(now: Date): Promise<boolean> {
    const seen = await this.deps.repos.scraperStatus.lastSeen();
    return !seen || now.getTime() - seen.getTime() > LIMITS.scraperSeenMs;
  }

  private async view(job: Job): Promise<JobView> {
    const { repos } = this.deps;
    const now = this.deps.now();
    const queued = job.status === 'queued';
    const slug = job.status === 'done' && job.datasetId ? await repos.datasets.slugById(job.datasetId) : null;
    return {
      id: job.id,
      kind: job.kind,
      status: job.status,
      stage: job.stage,
      position: queued ? await repos.jobs.position(job) : null,
      waking: queued && (await this.waking(now)),
      datasetSlug: slug,
      error: job.status === 'failed' ? publicJobError(job) : null,
      createdAt: job.createdAt.toISOString(),
      elapsedSec: Math.max(0, Math.round(((job.finishedAt ?? now).getTime() - job.createdAt.getTime()) / 1000)),
    };
  }
}

/** The stored code and message go through the same public envelope as API errors. */
function publicJobError(job: Job) {
  const code = (job.errorCode && job.errorCode in ERRORS ? job.errorCode : 'INTERNAL') as ErrorCode;
  return new AppError(code, job.errorMessage ? { message: job.errorMessage } : {}).toPublic(job.id);
}
