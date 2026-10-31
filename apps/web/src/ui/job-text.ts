import type { JobView } from '@/server/schemas';
import { count } from './format';

export const STAGES = ['opening', 'extracting', 'checking', 'saving'] as const;

/** One line of state for a job, from its status, stage and queue position. */
export function jobText(job: JobView): string {
  if (job.status === 'queued') {
    if (job.waking) return 'Waking up scraper…';
    if (job.position && job.position > 0) return `In line, ${job.position} ahead of you`;
    return 'Starting…';
  }
  if (job.status === 'done') return job.kind === 'add' ? 'Added' : 'Updated';
  if (job.status === 'failed') return 'Failed';
  const [stage, arg] = job.stage.split(':');
  switch (stage) {
    case 'extracting':
      return 'Finding seating data';
    case 'checking':
      return 'Checking data';
    case 'saving':
      return arg ? `Saving ${count(Number(arg))} seats` : 'Saving';
    default:
      return 'Opening page';
  }
}

/** How many of the four stage ticks are filled. */
export function jobProgress(job: JobView): number {
  if (job.status === 'done') return STAGES.length;
  if (job.status !== 'running') return 0;
  const i = STAGES.indexOf(job.stage.split(':')[0] as (typeof STAGES)[number]);
  return i < 0 ? 1 : i + 1;
}

export const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
