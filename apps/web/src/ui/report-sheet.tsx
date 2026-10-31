'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { apiFetch, ClientError } from '@/client/api-fetch';
import { ErrorState } from './error-state';

const REASONS = [
  { id: 'wrong_source', label: 'Wrong source page' },
  { id: 'outdated', label: 'Out of date' },
  { id: 'wrong_data', label: 'Seats look wrong' },
  { id: 'other', label: 'Something else' },
] as const;

export function ReportSheet({ slug, open, onOpenChange }: { slug: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<ClientError | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      await apiFetch(`/api/datasets/${slug}/reports`, { method: 'POST', body: JSON.stringify({ reason, ...(note.trim() ? { note: note.trim() } : {}) }) });
      setStatus('sent');
    } catch (err) {
      setError(err instanceof ClientError ? err : new ClientError({ code: 'INTERNAL', message: 'Something went wrong on our side.', retryable: true }));
      setStatus('idle');
    }
  }

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o && status === 'sent') {
      setStatus('idle');
      setReason('');
      setNote('');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-surface p-6 pb-8 text-ink shadow-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          <Dialog.Title className="text-lg font-semibold">Report this department</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">Tell the owner what looks wrong. One report per department per day.</Dialog.Description>

          {status === 'sent' ? (
            <div className="mt-5">
              <p className="font-medium">Reported. The owner has been told.</p>
              <Dialog.Close className="btn btn-secondary mt-4">Close</Dialog.Close>
            </div>
          ) : (
            <form onSubmit={send} className="mt-4">
              <fieldset>
                <legend className="sr-only">Reason</legend>
                {REASONS.map((r) => (
                  <label key={r.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-surface-2">
                    <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="h-4 w-4 accent-[var(--accent)]" />
                    {r.label}
                  </label>
                ))}
              </fieldset>
              <label htmlFor="note" className="mt-3 block text-sm text-muted">Note (optional)</label>
              <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="field mt-1 py-2 text-sm" />
              <p className="text-right font-mono text-xs text-muted">{note.length}/500</p>
              {error && <ErrorState compact error={{ code: error.code, message: error.message, retryable: false }} />}
              <button type="submit" disabled={!reason || status === 'sending'} className="btn btn-primary mt-3 w-full">
                {status === 'sending' ? 'Sending…' : 'Send report'}
              </button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
