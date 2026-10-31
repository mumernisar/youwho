'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ClientError } from '@/client/api-fetch';
import { ErrorState } from './error-state';

export function AdminSignIn() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/admin/session', { method: 'POST', body: JSON.stringify({ token }) });
      setToken('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientError ? err : new ClientError({ code: 'INTERNAL', message: 'Something went wrong on our side.', retryable: true }));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm pt-16">
      <h1 className="mb-4 text-lg font-semibold">Admin</h1>
      <label htmlFor="token" className="sr-only">Admin token</label>
      <input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" className="w-full rounded border border-ink bg-surface px-3 py-3 font-mono" />
      <button type="submit" disabled={busy || !token} className="mt-3 min-h-11 w-full rounded bg-ink px-4 font-medium text-bg disabled:opacity-40">Sign in</button>
      {error && <ErrorState compact error={{ code: error.code, message: error.message, retryable: false }} />}
    </form>
  );
}
