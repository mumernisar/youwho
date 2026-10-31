'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import type { DatasetSummary, JobView } from '@/server/schemas';
import { apiFetch, ClientError } from '@/client/api-fetch';
import { useJob } from '@/client/use-job';
import { ErrorState } from './error-state';
import { JobStatus } from './job-status';
import { jobText } from './job-text';

interface Tracker {
  /** Open the sheet to add a department. */
  openAdd(): void;
  /** Re-scrape a department already on the board. */
  refresh(url: string): void;
}

const Ctx = createContext<Tracker | null>(null);
export const useTracker = (): Tracker => {
  const t = useContext(Ctx);
  if (!t) throw new ClientError({ code: 'INTERNAL', message: 'Tracker is missing', retryable: false });
  return t;
};

const STORE = 'yw_job';
const store = {
  get: () => { try { return sessionStorage.getItem(STORE); } catch { return null; } },
  set: (v: string | null) => {
    try {
      if (v) sessionStorage.setItem(STORE, v);
      else sessionStorage.removeItem(STORE);
    } catch {
      /* optional */
    }
  },
};

type Submitted = { job: JobView } | { dataset: DatasetSummary };

/** Owns the add and refresh flow: the sheet, the job being tracked, and the small toast once closed. */
export function AddDepartmentProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [existing, setExisting] = useState<DatasetSummary | null>(null);
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastKind, setLastKind] = useState<'add' | 'refresh'>('add');
  const { job, pollError } = useJob(jobId);

  useEffect(() => { setJobId(store.get()); }, []);
  useEffect(() => { if (job?.status === 'done') router.refresh(); }, [job?.status, router]);
  useEffect(() => { if (job && (job.status === 'done' || job.status === 'failed')) store.set(null); }, [job]);

  const submit = useCallback(async (target: string, kind: 'add' | 'refresh') => {
    setBusy(true);
    setError(null);
    setExisting(null);
    setLastKind(kind);
    try {
      const res = await apiFetch<Submitted>('/api/jobs', { method: 'POST', body: JSON.stringify({ url: target, kind }) });
      if ('dataset' in res) setExisting(res.dataset);
      else { setJobId(res.job.id); store.set(res.job.id); }
    } catch (e) {
      setError(e instanceof ClientError ? e : new ClientError({ code: 'INTERNAL', message: 'Something went wrong on our side.', retryable: true }));
    } finally {
      setBusy(false);
    }
  }, []);

  const tracker = useMemo<Tracker>(() => ({
    openAdd: () => { setOpen(true); void apiFetch('/api/scraper/wake', { method: 'POST' }).catch(() => {}); },
    refresh: (target) => { setUrl(target); setOpen(true); void submit(target, 'refresh'); },
  }), [submit]);

  const active = job && (job.status === 'queued' || job.status === 'running');
  const showForm = !jobId && !existing && !busy;
  const reset = () => { setJobId(null); store.set(null); setExisting(null); setError(null); setUrl(''); };

  return (
    <Ctx.Provider value={tracker}>
      {children}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border border-rule bg-surface p-5 pb-8 text-ink sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
            <Dialog.Title className="text-lg font-semibold">{lastKind === 'refresh' && jobId ? 'Update department' : 'Add a department'}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">Paste the link of the department&apos;s public Google Sites seating page.</Dialog.Description>

            {showForm && (
              <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void submit(url, 'add'); }}>
                <label htmlFor="src" className="sr-only">Google Sites link</label>
                <input id="src" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://sites.google.com/view/…" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  className="w-full rounded border border-ink bg-bg px-3 py-3 font-mono text-sm" />
                <button type="submit" disabled={!url.trim()} className="mt-3 min-h-11 w-full rounded bg-ink px-4 font-medium text-bg disabled:opacity-40">Add</button>
              </form>
            )}
            {busy && <p className="mt-4 text-muted">Sending…</p>}
            {error && <ErrorState compact error={{ code: error.code, message: error.message, retryable: error.retryable, ...(error.requestId ? { requestId: error.requestId } : {}) }} onRetry={reset} />}
            {existing && (
              <div className="mt-4">
                <p className="font-medium">That department is already on the board.</p>
                <Link href={`/d/${existing.slug}`} onClick={() => { setOpen(false); reset(); }} className="mt-3 inline-flex min-h-11 items-center rounded bg-ink px-4 text-sm font-medium text-bg">Open {existing.label}</Link>
              </div>
            )}
            {jobId && !job && !pollError && <p className="mt-4 text-muted">Checking status…</p>}
            {pollError?.code === 'JOB_NOT_FOUND' && <ErrorState compact error={{ code: pollError.code, message: pollError.message, retryable: false }} onRetry={reset} />}
            {job && (
              <div className="mt-5">
                <JobStatus job={job} onClose={() => { setOpen(false); reset(); }} onRetry={() => { const u = url || ''; reset(); setUrl(u); if (u) void submit(u, lastKind); }} />
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {!open && job && (active || job.status === 'done') && (
        <button type="button" onClick={() => setOpen(true)} className="fixed right-4 bottom-4 z-30 flex min-h-11 items-center gap-3 rounded border border-ink bg-surface px-4 text-sm shadow" aria-live="polite">
          <span>{jobText(job)}</span>
          {job.status === 'done' && <span className="font-medium underline">View</span>}
        </button>
      )}
    </Ctx.Provider>
  );
}
