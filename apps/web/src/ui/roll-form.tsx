'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ClientError } from '@/client/api-fetch';
import { formatRegInput } from './format';
import { ErrorState } from './error-state';

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
    <form onSubmit={submit} className="mx-auto max-w-md">
      <label htmlFor="reg" className="sr-only">Registration number</label>
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
        className="w-full rounded border border-ink bg-surface px-4 py-4 text-center font-mono text-2xl tracking-wide placeholder:text-muted/60"
      />
      <button type="submit" disabled={busy || value.length < 8} className="mt-3 min-h-11 w-full rounded bg-ink px-4 font-medium text-bg disabled:opacity-40">
        {busy ? 'Looking up…' : 'Show'}
      </button>
      {error && (
        <div aria-live="polite">
          <ErrorState compact error={{ code: error.code, message: error.message, retryable: error.retryable, ...(error.requestId ? { requestId: error.requestId } : {}) }} />
        </div>
      )}
    </form>
  );
}
