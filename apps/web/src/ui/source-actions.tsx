'use client';

import { useState } from 'react';
import { apiFetch, ClientError } from '@/client/api-fetch';
import { ErrorState } from './error-state';
import { ReportSheet } from './report-sheet';

const toClient = (e: unknown) =>
  e instanceof ClientError ? e : new ClientError({ code: 'INTERNAL', message: 'Something went wrong on our side.', retryable: true });

/** Looks right (a toggle, updated optimistically and rolled back on error) and Report. */
export function SourceActions({ slug, confirms, confirmed }: { slug: string; confirms: number; confirmed: boolean }) {
  const [state, setState] = useState({ confirmed, count: confirms });
  const [error, setError] = useState<ClientError | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const before = state;
    setBusy(true);
    setError(null);
    setState({ confirmed: !before.confirmed, count: before.count + (before.confirmed ? -1 : 1) });
    try {
      const res = await apiFetch<{ confirmed: boolean; count: number }>(`/api/datasets/${slug}/confirm`, { method: 'POST' });
      setState(res);
    } catch (e) {
      setState(before);
      setError(toClient(e));
    } finally {
      setBusy(false);
    }
  }

  const btn = 'min-h-11 rounded border border-rule px-3 text-sm hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg';
  return (
    <div>
      <div className="flex gap-2">
        <button type="button" onClick={toggle} aria-pressed={state.confirmed} className={btn}>
          Looks right · <span className="font-mono">{state.count}</span>
        </button>
        <button type="button" onClick={() => setReportOpen(true)} className={btn}>Report</button>
      </div>
      {error && <ErrorState compact error={{ code: error.code, message: error.message, retryable: false }} />}
      <ReportSheet slug={slug} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
