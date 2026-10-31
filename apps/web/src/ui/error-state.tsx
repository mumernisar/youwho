'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PublicError } from '@youwho/errors';
import { ERROR_COPY, type ErrorIcon } from './error-copy';
import { ArrowRight, Refresh } from './icons';

const PATHS: Record<ErrorIcon, string> = {
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 3-4.5-4.5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  offline: 'M3 3l18 18M8.5 8.5A10 10 0 0 0 2 12m20 0a10 10 0 0 0-3.2-3.1M6 15a8 8 0 0 1 3-2m5.5.3A8 8 0 0 1 18 15M12 19v.01',
};

/** Renders any error: inline, in a sheet, or as a full page. Takes the public envelope error. */
export function ErrorState({ error, onRetry, compact }: { error: PublicError; onRetry?: () => void; compact?: boolean }) {
  const router = useRouter();
  const copy = ERROR_COPY[error.code];
  const retry = onRetry ?? (() => router.refresh());
  const actions = (
    <>
      {copy.action === 'retry' && error.retryable && (
        <button type="button" className={`btn btn-primary ${compact ? 'btn-sm' : ''}`} onClick={retry}><Refresh className="h-4 w-4" />Try again</button>
      )}
      {(copy.action === 'go-home' || copy.action === 'edit-input' || copy.action === 'add-department') && !compact && (
        <Link href="/" className="btn btn-secondary">{copy.action === 'add-department' ? 'Add a department' : 'Back to search'}<ArrowRight className="h-4 w-4" /></Link>
      )}
    </>
  );
  const icon = (
    <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--danger)_12%,var(--surface))] text-danger">
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS[copy.icon]} /></svg>
    </span>
  );

  if (compact) {
    return (
      <div role="alert" className="mt-3 flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{copy.heading}</p>
          <p className="text-sm text-muted">{error.message}</p>
          {error.retryable && copy.action === 'retry' && <div className="mt-2">{actions}</div>}
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      {icon}
      <h2 className="mt-4 text-xl font-bold">{copy.heading}</h2>
      <p className="mt-1 text-muted">{error.message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>
      {error.requestId && <p className="mt-6 font-mono text-xs text-muted">ref {error.requestId.slice(0, 8)}</p>}
    </div>
  );
}
