'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ClientError } from '@/client/api-fetch';
import { formatRegInput } from './format';
import { ERROR_COPY } from './error-copy';
import { ArrowRight, Search } from './icons';

const KEY = 'yw_last_reg';

export function RollForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem(KEY);
      if (last) setValue(last);
    } catch {
      /* storage can be blocked; the field just starts empty */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ reg: string }>(`/api/lookup?reg=${encodeURIComponent(value)}`);
      try {
        localStorage.setItem(KEY, res.reg);
      } catch {
        /* optional convenience */
      }
      router.push(`/r/${res.reg}`);
    } catch (err) {
      setError(err instanceof ClientError ? err : new ClientError({ code: 'INTERNAL', message: 'Something went wrong on our side.', retryable: true }));
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-2 rounded-2xl bg-accent p-1.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.5)] sm:flex-row sm:gap-1.5">
        <label htmlFor="reg" className="relative flex-1">
          <span className="sr-only">Registration number</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            ref={input}
            id="reg"
            value={value}
            onChange={(e) => setValue(formatRegInput(e.target.value))}
            placeholder="FA24-BSE-058"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'reg-error' : 'reg-hint'}
            className="h-14 w-full rounded-xl border-0 bg-surface pr-4 pl-12 font-mono text-xl tracking-wide text-ink placeholder:text-muted/70 focus:ring-4 focus:ring-brand/25 focus:outline-none"
          />
        </label>
        <button type="submit" disabled={busy} className="btn btn-primary h-14 rounded-xl px-6 text-base">
          {busy ? 'Looking up…' : 'Show my seat'}
          {!busy && <ArrowRight className="h-5 w-5" />}
        </button>
      </div>
      <div aria-live="polite" className="mt-3 min-h-6 text-sm">
        {error ? (
          <p id="reg-error" className="inline-flex rounded-lg bg-surface px-3 py-1.5 font-medium text-danger shadow">
            {ERROR_COPY[error.code].heading}: {error.message}
          </p>
        ) : (
          <p id="reg-hint" className="text-head-ink/70">Lowercase and missing dashes are fine.</p>
        )}
      </div>
    </form>
  );
}
