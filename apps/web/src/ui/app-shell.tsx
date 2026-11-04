'use client';

import { useEffect } from 'react';
import { APP_COOKIE, isStandalone } from '@/client/app-mode';
import { captureInstallPrompt } from '@/client/install-prompt';
import { clearOffline } from '@/client/saved';
import { OFFLINE_ENABLED } from '../site-status';

async function retire(): Promise<void> {
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
  await Promise.all(regs.map((r) => r.unregister()));
  await clearOffline();
}

/**
 * Renders nothing. In a browser tab it only keeps the install event for the ribbon. In the
 * installed app it marks the app with a cookie and registers the service worker after load, so
 * the worker never competes with the first render.
 */
export function AppShell() {
  useEffect(() => {
    if (!OFFLINE_ENABLED) {
      void retire().catch(() => undefined);
      return;
    }
    captureInstallPrompt();
    if (!isStandalone() || !('serviceWorker' in navigator)) return;
    document.cookie = `${APP_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax`;
    // A failed registration only means no offline copy; the site works the same.
    const register = () => void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
