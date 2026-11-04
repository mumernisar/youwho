'use client';

import { useEffect, useState } from 'react';
import { ClientError } from '@/client/api-fetch';
import { getSaved, listSaved, MAX_SAVED, refreshSaved, removeSaved, savePapers } from '@/client/saved';
import { ERROR_COPY } from './error-copy';
import { fmtStamp } from './format';
import { PhoneCheck, PhoneSave } from './icons';

/** "Saved on this device · Last updated …". Shared with the saved copy's own page. */
export function SavedStrip({ refreshedAt, onRemove }: { refreshedAt: string; onRemove: () => void }) {
  return (
    <div className="save-strip">
      <span className="save-icon save-icon-done"><PhoneCheck className="h-5 w-5" /></span>
      <p className="min-w-0 flex-1">
        <span className="block font-semibold">Saved on this device</span>
        <span className="block text-sm text-muted">Last updated <span className="whitespace-nowrap">{fmtStamp(refreshedAt)}</span></span>
      </p>
      <button type="button" onClick={onRemove} className="btn btn-quiet btn-sm">Remove</button>
    </div>
  );
}

type State =
  | { kind: 'checking' }
  | { kind: 'unsaved'; full: boolean }
  | { kind: 'saving' }
  | { kind: 'saved'; refreshedAt: string };

/**
 * The papers page's save control. Installed app only (see SaveGate). A saved number brings its copy
 * up to date quietly in the background; the page itself already shows the server's data.
 */
export function SavePapers({ reg }: { reg: string }) {
  const [state, setState] = useState<State>({ kind: 'checking' });
  const [error, setError] = useState<ClientError | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const copy = await getSaved(reg);
      if (!live) return;
      if (!copy) {
        setState({ kind: 'unsaved', full: (await listSaved()).length >= MAX_SAVED });
        return;
      }
      setState({ kind: 'saved', refreshedAt: copy.refreshedAt });
      const { copy: fresh } = await refreshSaved(reg);
      if (live && fresh) setState({ kind: 'saved', refreshedAt: fresh.refreshedAt });
    })();
    return () => {
      live = false;
    };
  }, [reg]);

  async function save() {
    setState({ kind: 'saving' });
    setError(null);
    try {
      const copy = await savePapers(reg);
      setState({ kind: 'saved', refreshedAt: copy.refreshedAt });
    } catch (err) {
      setError(err instanceof ClientError ? err : new ClientError({ code: 'DEVICE_STORAGE_FAILED', message: "Couldn't save on this device. Free some space and try again.", retryable: true }));
      setState({ kind: 'unsaved', full: false });
    }
  }

  async function remove() {
    await removeSaved(reg);
    setState({ kind: 'unsaved', full: false });
  }

  if (state.kind === 'checking') return null;
  return (
    <div aria-live="polite" className="save-wrap">
      {state.kind === 'saved' ? (
        <SavedStrip refreshedAt={state.refreshedAt} onRemove={remove} />
      ) : state.kind === 'unsaved' && state.full ? (
        <div className="save-strip">
          <span className="save-icon"><PhoneSave className="h-5 w-5" /></span>
          <p className="min-w-0 flex-1 text-sm text-ink-2">
            {MAX_SAVED} numbers are saved on this device. Remove one to save this one.
          </p>
        </div>
      ) : (
        <div className="save-strip save-strip-offer">
          <span className="save-icon"><PhoneSave className="h-5 w-5" /></span>
          <p className="min-w-0 flex-1 font-semibold">Keep these papers on your phone</p>
          <button type="button" onClick={save} disabled={state.kind === 'saving'} className="btn btn-primary btn-sm save-btn">
            {state.kind === 'saving' ? 'Saving…' : 'Save to this device'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {ERROR_COPY[error.code].heading}: {error.message}
        </p>
      )}
    </div>
  );
}
