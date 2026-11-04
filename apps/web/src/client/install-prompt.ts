import { useSyncExternalStore } from 'react';

/** Chromium's install event. Not in the DOM typings yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/**
 * Keeps Chromium's install event for the ribbon's sheet and stops the browser's own bottom bar,
 * so a phone shows one suggestion, not two. Called once from the layout.
 */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** Whether the browser can show its install dialog right now, and whether the app was just installed. */
export function useInstallPrompt(): { canPrompt: boolean; installed: boolean } {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const done = useSyncExternalStore(subscribe, () => installed, () => false);
  return { canPrompt, installed: done };
}

/** Opens the browser's install dialog. The event can be used once, so it is dropped afterwards. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  emit();
  await e.prompt();
  return (await e.userChoice).outcome;
}
