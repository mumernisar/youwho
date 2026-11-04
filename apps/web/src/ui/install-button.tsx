'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useInstallPrompt } from '@/client/install-prompt';
import { PhoneSave } from './icons';

const loadSheet = () => import('./install-sheet').then((m) => m.InstallSheet);
// The sheet loads when the button is first touched, not with the page.
const InstallSheet = dynamic(loadSheet, { ssr: false });

/**
 * The install offer, beside Home on the papers page. Rendered for phones by the server
 * (server/install.ts); hidden inside the app (CSS) and once the browser says the app is installed.
 * On arrival a rainbow light runs once around its border to point it out (.install-btn::before and ::after).
 * Once it scrolls out of view, an icon-only copy stays pinned at the top right until it comes back.
 */
export function InstallButton() {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const { installed } = useInstallPrompt();

  useEffect(() => {
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // Pinned only once the button has left through the top, not while it is still below the fold.
    const io = new IntersectionObserver(([e]) => setStuck(!!e && !e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [installed]);

  if (installed) return null;
  const sheetHandlers = {
    'aria-haspopup': 'dialog' as const,
    onClick: () => setOpen(true),
    onPointerEnter: () => void loadSheet(),
    onTouchStart: () => void loadSheet(),
  };
  return (
    <>
      <button ref={anchor} type="button" className="btn btn-secondary btn-sm install-btn" {...sheetHandlers}>
        <span className="install-btn-label">
          <PhoneSave className="install-btn-icon h-4 w-4" />
          Install app
        </span>
      </button>
      <button
        type="button"
        className="install-fab"
        data-shown={stuck}
        aria-label="Install app"
        aria-hidden={!stuck}
        tabIndex={stuck ? 0 : -1}
        {...sheetHandlers}
      >
        <PhoneSave className="h-5 w-5" />
      </button>
      {open && <InstallSheet open={open} onOpenChange={setOpen} onInstalled={() => setOpen(false)} />}
    </>
  );
}
