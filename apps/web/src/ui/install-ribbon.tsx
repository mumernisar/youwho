'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { RIBBON_COOKIE, RIBBON_DAYS } from '@/client/app-mode';
import { useInstallPrompt } from '@/client/install-prompt';
import { ChevronRight, PhoneSave, X } from './icons';

const loadSheet = () => import('./install-sheet').then((m) => m.InstallSheet);
// The sheet loads when the ribbon is first touched, not with the page.
const InstallSheet = dynamic(loadSheet, { ssr: false });

/**
 * The install suggestion on the papers page. The server renders it only for phones that have not
 * installed the app or closed it (see server/install.ts), so its space is there from the first paint
 * and nothing on the page jumps. CSS hides it inside the installed app.
 */
export function InstallRibbon() {
  const [phase, setPhase] = useState<'shown' | 'closing' | 'gone'>('shown');
  const [open, setOpen] = useState(false);
  const { installed } = useInstallPrompt();

  const close = () => {
    document.cookie = `${RIBBON_COOKIE}=closed; Path=/; Max-Age=${RIBBON_DAYS * 86400}; SameSite=Lax`;
    setPhase('closing');
  };
  useEffect(() => {
    if (installed) close();
  }, [installed]);

  if (phase === 'gone') return null;
  return (
    <div
      className="ribbon-slot"
      data-closing={phase === 'closing' || undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && phase === 'closing') setPhase('gone');
      }}
    >
      <div className="ribbon-row">
        <div className="ribbon" role="region" aria-label="Install youwho">
          <span aria-hidden className="ribbon-tail ribbon-tail-l" />
          <span aria-hidden className="ribbon-tail ribbon-tail-r" />
          <button
            type="button"
            className="ribbon-main"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            onPointerEnter={() => void loadSheet()}
            onTouchStart={() => void loadSheet()}
          >
            <span className="ribbon-icon"><PhoneSave className="h-[18px] w-[18px]" /></span>
            <span className="ribbon-text">
              <span className="ribbon-title">Add to Home Screen</span>
              <span className="ribbon-sub">Your papers, even offline</span>
            </span>
            <ChevronRight className="ribbon-chev h-4 w-4" />
          </button>
          <button type="button" className="ribbon-close" aria-label="Hide this suggestion" onClick={close}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {open && <InstallSheet open={open} onOpenChange={setOpen} onInstalled={close} />}
    </div>
  );
}
