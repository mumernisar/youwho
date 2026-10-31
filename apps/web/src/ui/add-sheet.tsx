'use client';

import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import type { DatasetSummary, JobView } from '@/server/schemas';
import type { ClientError } from '@/client/api-fetch';
import { ErrorState } from './error-state';
import { JobStatus } from './job-status';

export interface AddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  setUrl: (url: string) => void;
  lastKind: 'add' | 'refresh';
  jobId: string | null;
  job: JobView | null;
  pollError: ClientError | null;
  busy: boolean;
  error: ClientError | null;
  existing: DatasetSummary | null;
  showForm: boolean;
  submit: (url: string, kind: 'add' | 'refresh') => Promise<void>;
  reset: () => void;
}

/** The add and refresh sheet. Loaded on first open so the dialog code stays out of every page's bundle. */
export default function AddSheet({ open, onOpenChange, url, setUrl, lastKind, jobId, job, pollError, busy, error, existing, showForm, submit, reset }: AddSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-surface p-6 pb-8 text-ink shadow-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
            <Dialog.Title className="text-lg font-semibold">{lastKind === 'refresh' && jobId ? 'Update department' : 'Add a department'}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">Paste the link of the department&apos;s public Google Sites seating page.</Dialog.Description>

            {showForm && (
              <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void submit(url, 'add'); }}>
                <label htmlFor="src" className="sr-only">Google Sites link</label>
                <input id="src" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://sites.google.com/view/…" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  className="field font-mono text-sm" />
                <button type="submit" disabled={!url.trim()} className="btn btn-primary mt-3 w-full">Add</button>
              </form>
            )}
            {busy && <p className="mt-4 text-muted">Sending…</p>}
            {error && <ErrorState compact error={{ code: error.code, message: error.message, retryable: error.retryable, ...(error.requestId ? { requestId: error.requestId } : {}) }} onRetry={reset} />}
            {existing && (
              <div className="mt-4">
                <p className="font-medium">That department is already on the board.</p>
                <Link href={`/d/${existing.slug}`} onClick={() => { onOpenChange(false); reset(); }} className="btn btn-primary mt-3">Open {existing.label}</Link>
              </div>
            )}
            {jobId && !job && !pollError && <p className="mt-4 text-muted">Checking status…</p>}
            {pollError?.code === 'JOB_NOT_FOUND' && <ErrorState compact error={{ code: pollError.code, message: pollError.message, retryable: false }} onRetry={reset} />}
            {job && (
              <div className="mt-5">
                <JobStatus job={job} onClose={() => { onOpenChange(false); reset(); }} onRetry={() => { const u = url || ''; reset(); setUrl(u); if (u) void submit(u, lastKind); }} />
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
  );
}
