import { useSyncExternalStore } from 'react';

/**
 * The browser's install features, behind one small store. None of them are on every browser, and
 * each can fail (unsupported, blocked in an iframe or private mode, called twice, rejected). Every
 * failure means "cannot prompt" or "not known to be installed": the offers stay as they are, the
 * sheet falls back to the manual steps, and nothing about the failure is shown to the user.
 */

/** Chromium's install event. Not in the DOM typings yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type RelatedApps = Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };

let deferred: InstallPromptEvent | null = null;
let installed = false;
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function markInstalled(): void {
  deferred = null;
  installed = true;
  emit();
}

/** Chromium on Android says whether this site's app is installed (manifest related_applications), and no again after an uninstall. */
async function askInstalled(): Promise<void> {
  try {
    const apps = await (navigator as RelatedApps).getInstalledRelatedApps?.();
    if (Array.isArray(apps) && apps.length > 0) markInstalled();
  } catch {
    // Unsupported or refused: treated as not installed, so the offers stay.
  }
}

/**
 * Keeps Chromium's install event for the sheet and stops the browser's own bottom bar, so a phone
 * shows one suggestion, not two. Called from the layout; safe to call more than once.
 */
export function captureInstallPrompt(): void {
  if (started) return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    if (typeof (e as InstallPromptEvent).prompt !== 'function') return;
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', markInstalled);
  void askInstalled();
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** Whether the browser can show its install dialog right now, and whether the app is installed. */
export function useInstallPrompt(): { canPrompt: boolean; installed: boolean } {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const done = useSyncExternalStore(subscribe, () => installed, () => false);
  return { canPrompt, installed: done };
}

/**
 * Opens the browser's install dialog. The event works once, so it is dropped first. A failure
 * returns 'unavailable' and the sheet shows the manual steps instead.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  emit();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'unavailable';
  }
}
