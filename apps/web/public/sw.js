/*
 * youwho service worker. Hand-written, no build step. Registered only from the installed app.
 *
 * It does two things and nothing else:
 * - opening /r/{REG} for a number saved on this phone answers at once with the cached offline page
 *   (/saved), which renders the saved copy and refreshes it from the server in the background;
 * - when a page cannot be loaded at all, it answers with the same offline page, which lists the
 *   saved numbers.
 * It never caches API responses, room views or any page other than /saved. Cache names and the
 * saved-data keys must match apps/web/src/client/saved.ts.
 *
 * Kill switch: set RETIRED to true (and OFFLINE_ENABLED to false in src/site-status.ts) and deploy.
 */
const RETIRED = false;
const SHELL = 'yw-shell-v1';
const DATA = 'yw-saved-v1';
const SHELL_PATH = '/saved';
const KEEP = [SHELL, DATA];
const PAPERS = /^\/r\/([^/]+)\/?$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = (await caches.keys()).filter((n) => n.startsWith('yw-'));
      if (RETIRED) {
        await Promise.all(names.map((n) => caches.delete(n)));
        await self.registration.unregister();
        const pages = await self.clients.matchAll({ type: 'window' });
        pages.forEach((p) => p.navigate(p.url));
        return;
      }
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (RETIRED) return;
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') event.respondWith(navigate(req, url));
  else if (url.pathname.startsWith('/_next/static/')) event.respondWith(staticFile(req));
});

async function shell() {
  try {
    return await (await caches.open(SHELL)).match(SHELL_PATH);
  } catch {
    return undefined;
  }
}

async function isSaved(pathname) {
  const m = PAPERS.exec(pathname);
  if (!m) return false;
  try {
    const key = `/saved-data/${encodeURIComponent(decodeURIComponent(m[1]))}.json`;
    return !!(await (await caches.open(DATA)).match(key));
  } catch {
    return false;
  }
}

async function navigate(req, url) {
  if (await isSaved(url.pathname)) {
    const page = await shell();
    if (page) return page;
  }
  try {
    return await fetch(req);
  } catch (err) {
    const page = await shell();
    if (page) return page;
    throw err;
  }
}

async function staticFile(req) {
  try {
    const hit = await (await caches.open(SHELL)).match(req);
    if (hit) return hit;
  } catch {
    /* fall through to the network */
  }
  return fetch(req);
}
