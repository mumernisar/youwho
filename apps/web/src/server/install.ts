import 'server-only';
import { cookies, headers } from 'next/headers';
import { APP_COOKIE, RIBBON_COOKIE } from '@/client/app-mode';
import { OFFLINE_ENABLED } from '../site-status';

const PHONE = /iPhone|iPad|iPod|Android/;

/**
 * The install ribbon is decided on the server, so its space is part of the first paint. Phones only,
 * and not once the app is installed (Android shares cookies with Chrome) or the ribbon was closed.
 */
export async function showInstallRibbon(): Promise<boolean> {
  if (!OFFLINE_ENABLED) return false;
  const [h, c] = await Promise.all([headers(), cookies()]);
  if (c.has(APP_COOKIE) || c.has(RIBBON_COOKIE)) return false;
  return PHONE.test(h.get('user-agent') ?? '');
}
