'use client';

import { useEffect, useState } from 'react';
import { getSaved, listSaved, refreshSaved, removeSaved, SAVED_FORMAT, type SavedCopy } from '@/client/saved';
import { fmtStamp } from './format';
import { ArrowRight, PhoneSave } from './icons';
import { PageNav } from './page-nav';
import { initials } from './palette';
import { PaperList, StudentHeader } from './paper-list';
import { SavedStrip } from './save-papers';

const PAPERS = /^\/r\/([^/]+)\/?$/;

type State =
  | { kind: 'loading' }
  | { kind: 'papers'; copy: SavedCopy }
  | { kind: 'outdated'; reg: string }
  | { kind: 'list'; copies: SavedCopy[]; offline: boolean };

/** Opens a link with a full page load, so the service worker can answer it with or without a connection. */
const go = (href: string) => window.location.assign(href);

/**
 * Renders what is saved on the phone. At /r/{REG} it shows that number's saved papers at once and
 * quietly asks the server for newer ones; anywhere else it lists the saved numbers.
 */
export function SavedView() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    const showList = async () => {
      const copies = await listSaved();
      if (live) setState({ kind: 'list', copies, offline: !navigator.onLine });
    };
    const m = PAPERS.exec(window.location.pathname);
    const reg = m ? decodeURIComponent(m[1]!) : null;
    if (!reg) {
      void showList();
      return () => {
        live = false;
      };
    }

    const refresh = async () => {
      const { copy, gone } = await refreshSaved(reg);
      if (!live) return;
      // The site was taken down: its notice replaces the saved copy, which has been deleted.
      if (gone) return go('/');
      if (copy) setState({ kind: 'papers', copy });
      return copy;
    };

    void (async () => {
      const copy = await getSaved(reg);
      if (!live) return;
      if (!copy) return showList();
      setState(copy.v === SAVED_FORMAT ? { kind: 'papers', copy } : { kind: 'outdated', reg });
      // No connection now: try once more when it comes back.
      if (!(await refresh())) window.addEventListener('online', () => void refresh(), { once: true });
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.kind === 'loading') return <div aria-hidden className="card mt-8 h-40 animate-pulse motion-reduce:animate-none" />;

  if (state.kind === 'outdated') {
    return (
      <div className="card mt-8 p-6">
        <h1 className="text-lg font-semibold">{state.reg}</h1>
        <p className="mt-1 text-muted">This saved copy is from an older version of youwho. Connect to the internet to update it.</p>
      </div>
    );
  }

  if (state.kind === 'list') return <SavedList copies={state.copies} offline={state.offline} />;

  const { copy } = state;
  const remove = async () => {
    await removeSaved(copy.reg);
    go(`/r/${copy.reg}`);
  };
  return (
    <article>
      <PageNav back={{ href: '/', label: 'Home' }} crumbs={[{ href: '/', label: 'Home' }, { label: copy.reg }]} />
      <StudentHeader view={copy.data}>
        <div className="save-wrap" aria-live="polite">
          <SavedStrip refreshedAt={copy.refreshedAt} onRemove={remove} />
        </div>
      </StudentHeader>
      <PaperList view={copy.data} live={false} />
    </article>
  );
}

function SavedList({ copies, offline }: { copies: SavedCopy[]; offline: boolean }) {
  return (
    <section className="mx-auto mt-10 max-w-xl">
      <div className="card p-6 sm:p-7">
        <span className="save-icon"><PhoneSave className="h-5 w-5" /></span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">{offline ? "You're offline" : 'Saved on this device'}</h1>
        <p className="mt-1 text-muted">
          {offline ? 'Search and room maps need a connection. Papers you saved still open.' : 'These papers open even without internet.'}
        </p>
        {copies.length > 0 ? (
          <ul className="mt-5 space-y-2">
            {copies.map((c) => (
              <li key={c.reg}>
                <a href={`/r/${c.reg}`} className="card-link flex items-center gap-3 p-3 pr-4">
                  <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-brand font-bold text-brand-ink">{initials(c.data.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.data.name}</span>
                    <span className="block font-mono text-sm text-ink-2">{c.reg}</span>
                    <span className="block text-xs text-muted">Last updated {fmtStamp(c.refreshedAt)}</span>
                  </span>
                  <span className="go"><ArrowRight className="h-4 w-4" /></span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-ink-2">Nothing is saved yet. Open your papers with a connection and tap Save to this device.</p>
        )}
      </div>
    </section>
  );
}
