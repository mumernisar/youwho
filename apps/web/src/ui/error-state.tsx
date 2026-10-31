'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PublicError } from '@youwho/errors';
import { ERROR_COPY, type ErrorIcon } from './error-copy';

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
  const btn = 'inline-flex min-h-11 items-center rounded border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-bg';
  return (
    <div role="alert" className={compact ? 'py-3' : 'mx-auto max-w-md px-4 py-16 text-center'}>
      <svg aria-hidden viewBox="0 0 24 24" className={`mx-auto mb-3 h-7 w-7 fill-none stroke-current ${compact ? 'hidden' : ''}`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[copy.icon]} />
      </svg>
      <h2 className="text-lg font-semibold">{copy.heading}</h2>
      <p className="mt-1 text-muted">{error.message}</p>
      <div className="mt-5 flex justify-center gap-3">
        {copy.action === 'retry' && error.retryable && (
          <button type="button" className={btn} onClick={retry}>Try again</button>
        )}
        {(copy.action === 'go-home' || copy.action === 'edit-input' || copy.action === 'add-department') && (
          <Link href="/" className={btn}>{copy.action === 'add-department' ? 'Add a department' : 'Back to start'}</Link>
        )}
      </div>
      {error.requestId && <p className="mt-6 font-mono text-xs text-muted">ref {error.requestId.slice(0, 8)}</p>}
    </div>
  );
}
