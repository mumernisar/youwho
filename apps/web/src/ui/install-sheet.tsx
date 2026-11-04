'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { platform } from '@/client/app-mode';
import { promptInstall, useInstallPrompt } from '@/client/install-prompt';
import { MoreVertical, PhoneSave, PlusSquare, Share, X } from './icons';

interface Step {
  title: React.ReactNode;
  hint: string;
}

const IOS: Step[] = [
  { title: <>Tap <Key icon={<Share className="h-4 w-4" />}>Share</Key></>, hint: "At the bottom of Safari. On newer iPhones it is under •••." },
  { title: <>Choose <Key icon={<PlusSquare className="h-4 w-4" />}>Add to Home Screen</Key></>, hint: "Scroll down the list if you don't see it." },
  { title: <>Tap <Key>Add</Key></>, hint: 'youwho appears on your Home Screen.' },
];

const ANDROID: Step[] = [
  { title: <>Open the menu <Key icon={<MoreVertical className="h-4 w-4" />} /></>, hint: 'Top right of the browser.' },
  { title: <>Tap <Key>Add to Home screen</Key></>, hint: 'Some browsers call it Install app.' },
  { title: <>Tap <Key>Install</Key></>, hint: 'youwho appears on your Home Screen.' },
];

/** Looks like the button the student is looking for on their screen. */
function Key({ icon, children }: { icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <span className="install-key">
      {icon}
      {children}
    </span>
  );
}

/** How to install, for this phone. Chromium can install from a button; Safari only by hand. */
export function InstallSheet({ open, onOpenChange, onInstalled }: { open: boolean; onOpenChange: (o: boolean) => void; onInstalled: () => void }) {
  const { canPrompt } = useInstallPrompt();
  const [os] = useState(platform);
  const [busy, setBusy] = useState(false);
  // The browser's dialog failed once: show the manual steps for the rest of this sheet.
  const [manual, setManual] = useState(false);
  const steps = os === 'ios' ? IOS : ANDROID;

  async function install() {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === 'unavailable') {
      setManual(true);
      return;
    }
    onOpenChange(false);
    if (outcome === 'accepted') onInstalled();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="sheet fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-surface p-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-ink shadow-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-6">
          <span aria-hidden className="mx-auto mb-5 block h-1 w-10 rounded-full bg-line sm:hidden" />
          <Dialog.Close className="btn btn-quiet btn-icon absolute top-3 right-3" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>

          <div className="flex flex-col items-center text-center">
            <span className="install-app">
              <img src="/icons/icon-192.png" alt="" width={64} height={64} className="rounded-[18px] shadow-lg" />
              <span className="install-app-label">Youwho</span>
            </span>
            <Dialog.Title className="mt-4 text-xl font-bold tracking-tight">Add youwho to your Home Screen</Dialog.Title>
            <Dialog.Description className="mt-1.5 max-w-xs text-sm text-muted">
              It opens full screen, like an app. Save your papers in it and they open even without internet.
            </Dialog.Description>
          </div>

          {canPrompt && !manual ? (
            <button type="button" onClick={install} disabled={busy} className="btn btn-primary mt-6 h-12 w-full text-base">
              Install youwho
            </button>
          ) : (
            <ol className="mt-6 space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="install-step">
                  <span aria-hidden className="install-num">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-7">{s.title}</span>
                    <span className="block text-sm text-muted">{s.hint}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
            <PhoneSave className="mt-0.5 h-4 w-4 flex-none text-brand" />
            Then open youwho from your Home Screen and tap Save to this device on your papers.
          </p>
          {(!canPrompt || manual) && (
            <Dialog.Close className="btn btn-secondary mt-4 h-12 w-full text-base">Got it</Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
