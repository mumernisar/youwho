// Only the reg module: the package index also loads the decoders (zod, acorn), which phones do not need.
import { normalizeReg } from '@youwho/core/src/reg';
import type { LookupView } from '@/server/schemas';
import { apiFetch, ClientError } from './api-fetch';

/**
 * Papers saved on the phone (installed app only). Stored in Cache Storage so the service worker
 * (public/sw.js) can see which numbers are saved without its own database code. Cache names and
 * keys here must match sw.js.
 *
 * Storage can be blocked, full or cleared by the phone at any time. This module is the adapter for
 * it: every failure is caught here and turned into a result, so nothing reaches React as a throw.
 */

/** Bump when LookupView changes shape; older copies are not rendered and are replaced on the next refresh. */
export const SAVED_FORMAT = 1;
export const MAX_SAVED = 5;
const DATA = 'yw-saved-v1';
const SHELL = 'yw-shell-v1';
export const SHELL_PATH = '/saved';
const STATIC_ASSET = /\/_next\/static\/[A-Za-z0-9_\-./~%]+/g;

export interface SavedCopy {
  v: number;
  reg: string;
  /** Last time the copy was confirmed against the server (ISO). */
  refreshedAt: string;
  data: LookupView;
}

const keyOf = (reg: string) => `/saved-data/${encodeURIComponent(reg)}.json`;
const supported = () => typeof caches !== 'undefined';

export async function getSaved(reg: string): Promise<SavedCopy | null> {
  if (!supported()) return null;
  try {
    const res = await (await caches.open(DATA)).match(keyOf(reg));
    return res ? ((await res.json()) as SavedCopy) : null;
  } catch {
    return null;
  }
}

/** The canonical number when what was typed is saved on this phone, so search can open it without the network. */
export async function savedRegFor(input: string): Promise<string | null> {
  const reg = normalizeReg(input);
  return reg && (await getSaved(reg)) ? reg : null;
}

export async function listSaved(): Promise<SavedCopy[]> {
  if (!supported()) return [];
  try {
    const cache = await caches.open(DATA);
    const copies = await Promise.all((await cache.keys()).map(async (k) => (await cache.match(k))?.json() as Promise<SavedCopy | undefined>));
    return copies.filter((c): c is SavedCopy => !!c).sort((a, b) => a.data.name.localeCompare(b.data.name));
  } catch {
    return [];
  }
}

export async function putSaved(data: LookupView, refreshedAt: Date): Promise<boolean> {
  if (!supported()) return false;
  try {
    const copy: SavedCopy = { v: SAVED_FORMAT, reg: data.reg, refreshedAt: refreshedAt.toISOString(), data };
    await (await caches.open(DATA)).put(keyOf(data.reg), new Response(JSON.stringify(copy), { headers: { 'content-type': 'application/json' } }));
    return true;
  } catch {
    return false;
  }
}

export async function removeSaved(reg: string): Promise<void> {
  if (!supported()) return;
  try {
    await (await caches.open(DATA)).delete(keyOf(reg));
  } catch {
    /* already gone or storage blocked: nothing left to remove either way */
  }
}

/** The kill switch (site-status OFFLINE_ENABLED = false): drop every saved copy and the offline page. */
export async function clearOffline(): Promise<void> {
  if (!supported()) return;
  try {
    await Promise.all((await caches.keys()).filter((n) => n.startsWith('yw-')).map((n) => caches.delete(n)));
  } catch {
    /* nothing to clear */
  }
}

/**
 * Keeps the offline page and the files it loads in the shell cache. Runs after each save and refresh,
 * so a new deploy's files replace the old ones. Only same-origin /_next/static URLs from our own
 * HTML are fetched; nothing in them is run by this code.
 */
export async function cacheShell(): Promise<void> {
  if (!supported()) return;
  try {
    const page = await fetch(SHELL_PATH, { cache: 'no-cache', credentials: 'same-origin' });
    // A decommissioned site redirects; that must never become the offline page.
    if (!page.ok || page.redirected) return;
    const html = await page.clone().text();
    const assets = [...new Set(html.match(STATIC_ASSET) ?? [])];
    const cache = await caches.open(SHELL);
    const held = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
    const missing = assets.filter((a) => !held.has(a));
    await Promise.all(missing.map((a) => cache.add(a)));
    await cache.put(SHELL_PATH, page);
    const keep = new Set([SHELL_PATH, ...assets]);
    await Promise.all([...held].filter((p) => !keep.has(p)).map((p) => cache.delete(p)));
  } catch {
    /* offline or storage full: the previous shell stays */
  }
}

/** Asks the server for the latest papers without counting it as a search (`refresh=1`). */
export function fetchPapers(reg: string, signal?: AbortSignal): Promise<LookupView> {
  return apiFetch<LookupView>(`/api/lookup?reg=${encodeURIComponent(reg)}&refresh=1`, signal ? { signal } : undefined);
}

/** Save: fetch, store, then cache the offline page. Fails with DEVICE_STORAGE_FAILED when the phone refuses. */
export async function savePapers(reg: string): Promise<SavedCopy> {
  const data = await fetchPapers(reg);
  const at = new Date();
  if (!(await putSaved(data, at))) {
    throw new ClientError({ code: 'DEVICE_STORAGE_FAILED', message: "Couldn't save on this device. Free some space and try again.", retryable: true });
  }
  // Ask the browser to keep this data under storage pressure; the answer does not change anything here.
  void navigator.storage?.persist?.().catch(() => false);
  void cacheShell();
  return { v: SAVED_FORMAT, reg: data.reg, refreshedAt: at.toISOString(), data };
}

const REFRESH_TIMEOUT_MS = 15_000;

/**
 * Brings a saved copy up to date in the background. Never shows a loading state: on success it
 * stores the new data and returns it; on any failure the saved copy simply stays.
 * `gone` is true when the site has been taken down, in which case the copy is deleted.
 */
export async function refreshSaved(reg: string): Promise<{ copy: SavedCopy | null; gone: boolean }> {
  try {
    const data = await fetchPapers(reg, AbortSignal.timeout(REFRESH_TIMEOUT_MS));
    const at = new Date();
    await putSaved(data, at);
    void cacheShell();
    return { copy: { v: SAVED_FORMAT, reg: data.reg, refreshedAt: at.toISOString(), data }, gone: false };
  } catch (err) {
    if (err instanceof ClientError && err.code === 'SITE_DECOMMISSIONED') {
      await removeSaved(reg);
      return { copy: null, gone: true };
    }
    return { copy: null, gone: false };
  }
}
