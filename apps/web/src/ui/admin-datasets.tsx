'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { apiFetch, ClientError } from '@/client/api-fetch';
import { count, fmtUpdated } from './format';
import { ErrorState } from './error-state';
import { SourceLink } from './source-notice';

export interface AdminRow {
  slug: string;
  label: string;
  sourceUrl: string;
  students: number;
  seats: number;
  confirms: number;
  reports: number;
  createdAt: string;
}

interface Report { id: string; reason: string; note: string | null; createdAt: string }

const toClient = (e: unknown) =>
  e instanceof ClientError ? e : new ClientError({ code: 'INTERNAL', message: 'Something went wrong on our side.', retryable: true });

export function AdminDatasets({ rows }: { rows: AdminRow[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openReports, setOpenReports] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = rows.filter((r) => picked.has(r.slug));
  const toggle = (slug: string) => setPicked((p) => { const n = new Set(p); if (!n.delete(slug)) n.add(slug); return n; });

  async function showReports(slug: string) {
    if (openReports === slug) return setOpenReports(null);
    setError(null);
    try {
      setReports(await apiFetch<Report[]>(`/api/admin/datasets/${slug}/reports`));
      setOpenReports(slug);
    } catch (e) {
      setError(toClient(e));
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/admin/datasets/delete', { method: 'POST', body: JSON.stringify({ slugs: chosen.map((c) => c.slug) }) });
      setPicked(new Set());
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      setError(toClient(e));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await apiFetch('/api/admin/session', { method: 'DELETE' }).catch(() => {});
    router.refresh();
  }

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Admin</h1>
        <button type="button" onClick={signOut} className="btn btn-secondary btn-sm">Sign out</button>
      </div>

      {error && <ErrorState compact error={{ code: error.code, message: error.message, retryable: false }} />}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-rule text-muted">
            <tr>
              <th className="w-10 py-2"><span className="sr-only">Select</span></th>
              <th>Department</th><th>Source</th><th className="text-right">Students / seats</th><th className="text-right">Looks right</th><th className="text-right">Reports</th><th className="text-right">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-muted">No departments.</td></tr>}
            {rows.map((r) => (
              <Fragment key={r.slug}>
                <tr>
                  <td className="py-2"><input type="checkbox" aria-label={`Select ${r.label}`} checked={picked.has(r.slug)} onChange={() => toggle(r.slug)} className="h-5 w-5 accent-[var(--accent)]" /></td>
                  <td><span className="font-medium">{r.label}</span><span className="block font-mono text-xs text-muted">{r.slug}</span></td>
                  <td className="max-w-56"><SourceLink url={r.sourceUrl} className="text-xs" /></td>
                  <td className="text-right font-mono">{count(r.students)} / {count(r.seats)}</td>
                  <td className="text-right font-mono">{r.confirms}</td>
                  <td className="text-right">
                    <button type="button" disabled={r.reports === 0} onClick={() => showReports(r.slug)} className="min-h-6 font-mono underline disabled:no-underline disabled:text-muted">{r.reports}</button>
                  </td>
                  <td className="text-right font-mono">{fmtUpdated(r.createdAt)}</td>
                </tr>
                {openReports === r.slug && (
                  <tr>
                    <td />
                    <td colSpan={6} className="pb-3">
                      <ul className="space-y-1">
                        {reports.map((x) => (
                          <li key={x.id} className="text-sm"><span className="font-medium">{x.reason}</span>{x.note ? ` — ${x.note}` : ''} <span className="font-mono text-xs text-muted">{new Date(x.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })}</span></li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" disabled={chosen.length === 0} onClick={() => setConfirmOpen(true)} className="btn btn-danger mt-5">
        Delete selected{chosen.length ? ` (${chosen.length})` : ''}
      </button>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface p-6 text-ink shadow-2xl">
            <Dialog.Title className="text-lg font-semibold">Delete {chosen.length} {chosen.length === 1 ? 'department' : 'departments'}?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">Their students, seats, votes and reports will be removed, and queued jobs for these links will fail. Anyone can add a deleted link again.</Dialog.Description>
            <ul className="mt-3 space-y-2">
              {chosen.map((c) => <li key={c.slug}><span className="font-medium">{c.label}</span><span className="block break-all font-mono text-xs text-muted">{c.sourceUrl}</span></li>)}
            </ul>
            <div className="mt-5 flex justify-end gap-3">
              <Dialog.Close className="btn btn-secondary">Cancel</Dialog.Close>
              <button type="button" onClick={remove} disabled={busy} className="btn btn-danger">{busy ? 'Deleting…' : 'Delete'}</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
