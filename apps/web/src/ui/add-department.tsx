'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { DatasetSummary, JobView } from '@/server/schemas';
import { apiFetch, ClientError } from '@/client/api-fetch';
import { useJob } from '@/client/use-job';
import { jobText } from './job-text';

interface Tracker {
  /** Open the sheet to add a department. */
  openAdd(): void;
  /** Re-scrape a department already on the board. */
  refresh(url: string): void;
}

const AddSheet = dynamic(() => import('./add-sheet'), { ssr: false });

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
  const [everOpened, setEverOpened] = useState(false);
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
    openAdd: () => { setEverOpened(true); setOpen(true); void apiFetch('/api/scraper/wake', { method: 'POST' }).catch(() => {}); },
    refresh: (target) => { setUrl(target); setEverOpened(true); setOpen(true); void submit(target, 'refresh'); },
  }), [submit]);

  const active = job && (job.status === 'queued' || job.status === 'running');
  const showForm = !jobId && !existing && !busy;
  const reset = () => { setJobId(null); store.set(null); setExisting(null); setError(null); setUrl(''); };

  return (
    <Ctx.Provider value={tracker}>
      {children}

      {everOpened && (
        <AddSheet
          open={open}
          onOpenChange={setOpen}
          url={url}
          setUrl={setUrl}
          lastKind={lastKind}
          jobId={jobId}
          job={job}
          pollError={pollError}
          busy={busy}
          error={error}
          existing={existing}
          showForm={showForm}
          submit={submit}
          reset={reset}
        />
      )}

      {!open && job && (active || job.status === 'done') && (
        <button type="button" onClick={() => { setEverOpened(true); setOpen(true); }} className="fixed right-4 bottom-4 z-30 flex min-h-11 items-center gap-3 rounded border border-ink bg-surface px-4 text-sm shadow" aria-live="polite">
          <span>{jobText(job)}</span>
          {job.status === 'done' && <span className="font-medium underline">View</span>}
        </button>
      )}
    </Ctx.Provider>
  );
}
