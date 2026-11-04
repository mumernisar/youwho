import 'server-only';
import { headers } from 'next/headers';
import { OFFLINE_ENABLED } from '../site-status';

const PHONE = /iPhone|iPad|iPod|Android/;

/**
 * The Install app button is decided on the server, so it is part of the first paint: phones only.
 * Whether the app is installed is not known here (a cookie cannot see an uninstall); the browser
 * answers that on the page (install-prompt.ts) and the button hides itself.
 */
export async function showInstallButton(): Promise<boolean> {
  if (!OFFLINE_ENABLED) return false;
  return PHONE.test((await headers()).get('user-agent') ?? '');
}
