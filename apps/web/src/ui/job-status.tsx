'use client';

import Link from 'next/link';
import type { JobView } from '@/server/schemas';
import { useTick } from '@/client/use-job';
import { ErrorState } from './error-state';
import { jobProgress, jobText, mmss, STAGES } from './job-text';

/** The status card: one line of state, an elapsed timer and a thin rule with a tick per stage. */
export function JobStatus({ job, onRetry, onClose }: { job: JobView; onRetry: () => void; onClose: () => void }) {
  const active = job.status === 'queued' || job.status === 'running';
  const now = useTick(active);
  const elapsed = active ? Math.max(0, Math.round((now - new Date(job.createdAt).getTime()) / 1000)) : job.elapsedSec;
  const done = jobProgress(job);

  if (job.status === 'failed' && job.error) {
    return <ErrorState compact error={job.error} onRetry={onRetry} />;
  }
  return (
    <div aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-lg font-semibold">{jobText(job)}</p>
        <p className="font-mono text-sm text-muted">{mmss(elapsed)}</p>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden>
        {STAGES.map((s, i) => (
          <div key={s} className={`h-1.5 rounded-full ${i < done ? 'bg-brand' : 'bg-line'} ${job.status === 'running' && i === done - 1 ? 'animate-pulse' : ''}`} />
        ))}
      </div>
      {job.status === 'done' && (
        <div className="mt-5 flex gap-3">
          {job.datasetSlug && (
            <Link href={`/d/${job.datasetSlug}`} onClick={onClose} className="btn btn-primary">
              Open department
            </Link>
          )}
          <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      )}
    </div>
  );
}
