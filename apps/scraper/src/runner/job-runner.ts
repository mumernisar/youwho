import { AppError, ERRORS, fail, isAppError, toAppError } from '@youwho/errors';
import type { Logger } from '@youwho/config';
import type { Job, Repos } from '@youwho/db';
import type { Notifier } from '@youwho/notify';
import { decodeStep, persistStep } from '../pipeline/steps';
import type { PageSource } from '../sources';

export interface RunnerDeps {
  repos: Repos;
  source: PageSource;
  notifier: Notifier;
  log: Logger;
  limitMs: number;
  now(): Date;
  /** Called when cleanup has not finished 30 seconds after the deadline. Defaults to process.exit. */
  exit(code: number): void;
}

const HARD_EXIT_GRACE_MS = 30_000;
/** Below the web app's 30-second "seen" window, so a busy scraper never reads as asleep. */
const SEEN_EVERY_MS = 10_000;

/** Catalog message, plus the path or reason for data problems. Never student names or causes. */
function storedMessage(err: AppError): string {
  const d = err.details as { issues?: { path: string; message: string }[]; reason?: string; offset?: number } | undefined;
  if (err.code === 'DATA_SHAPE_INVALID' && d?.issues?.[0]) return `${err.message} (${d.issues[0].path || 'root'}: ${d.issues[0].message})`;
  if (err.code === 'DATA_DECODE_FAILED' && d?.reason) return `${err.message} (${d.reason})`;
  return err.def.expose ? err.message : ERRORS.INTERNAL.message;
}

export function createRunner(deps: RunnerDeps) {
  const { repos, log } = deps;
  let running = false;
  let again = false;

  async function runJob(job: Job): Promise<void> {
    const jobLog = log.child({ jobId: job.id });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new AppError('SCRAPE_TIMEOUT')), deps.limitMs);
    const hardExit = setTimeout(() => {
      jobLog.error({ code: 'SCRAPE_TIMEOUT' }, 'cleanup did not finish after the deadline; exiting');
      deps.exit(1);
    }, deps.limitMs + HARD_EXIT_GRACE_MS);

    // Stage writes are serialised so they land in order and each one refreshes the heartbeat.
    let stages: Promise<unknown> = Promise.resolve();
    const stage = (name: string) => {
      stages = stages.then(() => repos.jobs.setStage(job.id, name, deps.now())).catch((e) => jobLog.warn({ err: e }, 'stage write failed'));
    };
    const checkDeadline = () => {
      if (ac.signal.aborted) fail('SCRAPE_TIMEOUT');
    };

    try {
      stage('opening');
      const read = await deps.source.read(job.sourceUrl, ac.signal, stage);
      checkDeadline();
      stage('checking');
      const decoded = decodeStep(read);
      checkDeadline();

      const existing = await repos.datasets.getBySourceUrl(job.sourceUrl);
      stage(`saving:${decoded.plan.seats.length}`);
      await stages;
      // From here the save may finish even if the deadline passes: a started transaction is not cut off.
      const saved = await persistStep(repos.datasets, { sourceUrl: job.sourceUrl, title: read.title, decoded, existingLabel: existing?.label ?? null, now: deps.now() });
      await repos.jobs.finishDone(job.id, saved.datasetId, deps.now());
      jobLog.info({ datasetId: saved.datasetId, created: saved.created, changed: saved.changed }, 'job done');

      const ds = await repos.datasets.getBySourceUrl(job.sourceUrl);
      if (ds && saved.created) {
        await deps.notifier.send({ type: 'dataset.added', slug: ds.slug, label: ds.label, sourceUrl: ds.sourceUrl, students: ds.students, seats: ds.seats, warnings: ds.warnings });
      } else if (ds && saved.changed) {
        await deps.notifier.send({ type: 'dataset.updated', slug: ds.slug, label: ds.label, sourceUrl: ds.sourceUrl, changed: true, seatsBefore: saved.seatsBefore, seatsAfter: ds.seats });
      }
      if (ds && !decoded.decoderKnown) {
        await deps.notifier.send({ type: 'decoder.unknown', slug: ds.slug, sourceUrl: ds.sourceUrl, logicHash: decoded.logicHash });
      }
    } catch (e) {
      // Anything that surfaces after the deadline is a timeout, whatever library threw it.
      const err = ac.signal.aborted && !isAppError(e) ? new AppError('SCRAPE_TIMEOUT', { cause: e }) : toAppError(e);
      const code = err.code;
      const stored = err;
      jobLog[err.def.log]({ code, err: err.cause ?? err }, 'job failed');
      // Only a running job can fail, so a late write never overwrites a sweep.
      await repos.jobs.fail(job.id, { code, message: storedMessage(stored) }, deps.now()).catch((e2) => jobLog.error({ err: e2 }, 'could not record failure'));
    } finally {
      clearTimeout(timer);
      clearTimeout(hardExit);
      await stages;
    }
  }

  /** Claim and run queued jobs one at a time. Extra calls while draining just ask for another pass. */
  async function drain(): Promise<void> {
    if (running) {
      again = true;
      return;
    }
    running = true;
    const seen = setInterval(() => void repos.scraperStatus.touch(deps.now()).catch((e) => log.warn({ err: e }, 'status write failed')), SEEN_EVERY_MS);
    try {
      do {
        again = false;
        await repos.scraperStatus.touch(deps.now());
        for (;;) {
          const job = await repos.jobs.claim(deps.now());
          if (!job) break;
          await runJob(job);
        }
      } while (again);
    } catch (e) {
      log.error({ err: e }, 'drain failed');
    } finally {
      clearInterval(seen);
      running = false;
    }
  }

  /** On start, any job still running belonged to a dead process. */
  async function bootSweep(): Promise<void> {
    const n = await repos.jobs.failAllRunning({ code: 'SCRAPER_RESTARTED', message: ERRORS.SCRAPER_RESTARTED.message }, deps.now());
    if (n > 0) log.warn({ jobs: n, code: 'SCRAPER_RESTARTED' }, 'failed jobs left running by a previous process');
  }

  return { drain, bootSweep };
}
