/*
 * youwho service worker. Hand-written, no build step. Registered only from the installed app.
 *
 * It does two things and nothing else:
 * - opening /r/{REG} for a number saved on this phone answers at once with the cached offline page
 *   (/saved), which renders the saved copy and refreshes it from the server in the background;
 * - when a page cannot be loaded at all, it answers with the same offline page, which lists the
 *   saved numbers;
 * - when the app is launched, numbers are saved and the server has not answered within 1 s, it shows
 *   a waiting screen with an Open saved papers button, and moves to the real page once it arrives.
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
const WAIT_MS = 1000;
/** Launch requests still loading behind the waiting screen, by URL; the waiting screen reopens the URL to take one. */
const pending = new Map();

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
  if (req.mode === 'navigate') event.respondWith(navigate(event, req, url));
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

async function navigate(event, req, url) {
  if (await isSaved(url.pathname)) {
    const page = await shell();
    if (page) return page;
  }
  // The waiting screen's button: the offline page has no server data, so the cached copy is the page.
  if (url.pathname === SHELL_PATH) {
    const page = await shell();
    if (page) return page;
  }
  const launch = await isLaunchWithSaved();
  // A launch never takes a held response: its waiting screen is gone (the button was tapped, or the app was closed).
  const held = launch ? undefined : pending.get(url.href);
  pending.delete(url.href);
  const network = held ?? fetch(req);
  if (launch) {
    const first = await Promise.race([network.then(() => 'network', () => 'network'), wait(WAIT_MS)]);
    if (first !== 'network') {
      pending.set(url.href, network);
      event.waitUntil(network.then(() => tell('yw-ready', url.href), () => tell('yw-failed', url.href)));
      return waitingPage();
    }
  }
  try {
    return await network;
  } catch (err) {
    const page = await shell();
    if (page) return page;
    throw err;
  }
}

const wait = (ms) => new Promise((done) => setTimeout(() => done('wait'), ms));

/** No window open yet (the app is starting) and something saved to open instead. */
async function isLaunchWithSaved() {
  try {
    if ((await self.clients.matchAll({ type: 'window' })).length > 0) return false;
    if (!(await shell())) return false;
    return (await (await caches.open(DATA)).keys()).length > 0;
  } catch {
    return false;
  }
}

/** Tells the waiting screen how its request ended. The waiting screen takes a held response at once; after 10 s it is dropped. */
async function tell(type, href) {
  const network = pending.get(href);
  if (type === 'yw-failed') pending.delete(href);
  const pages = await self.clients.matchAll({ type: 'window' });
  pages.forEach((p) => p.postMessage({ type, href }));
  await wait(10_000);
  if (pending.get(href) === network) pending.delete(href);
}

/*
 * Shown in place of the phone's launch screen, so it copies it: the Sand background from the manifest
 * and the app icon in the middle. A worker cannot read the theme cookie, so the colours are Sand's,
 * set as the same CSS variables the app uses. Fixed text only; nothing from the request is written in.
 */
const WAITING_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2b2016">
<title>youwho</title>
<style>
:root{color-scheme:light;--bg:#f4eee3;--ink:#241b12;--muted:#6b5d4b;--brand:#b3410e;--brand-ink:#fff}
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;
display:flex;flex-direction:column;align-items:center;
padding:max(24px,env(safe-area-inset-top)) 24px max(32px,env(safe-area-inset-bottom))}
main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}
svg{width:96px;height:96px;border-radius:22px}
#status{font-size:15px;color:var(--muted)}
footer{width:100%;max-width:360px;text-align:center;animation:in .25s ease-out both}
button{width:100%;min-height:52px;border:0;border-radius:14px;background:var(--brand);color:var(--brand-ink);
font-family:inherit;font-size:17px;font-weight:600;line-height:1.2;cursor:pointer}
button:focus-visible{outline:3px solid var(--ink);outline-offset:3px}
footer p{margin-top:10px;font-size:13px;color:var(--muted)}
@keyframes in{from{opacity:0;transform:translateY(8px)}}
@media (prefers-reduced-motion:reduce){footer{animation:none}}
</style></head>
<body>
<main>
<svg viewBox="0 0 32 32" role="img" aria-label="youwho"><rect width="32" height="32" rx="6" fill="#1b1a17"/><g fill="#f7f3ea"><rect x="6" y="6" width="6" height="6" rx="1.5" opacity=".45"/><rect x="13" y="6" width="6" height="6" rx="1.5" opacity=".45"/><rect x="20" y="6" width="6" height="6" rx="1.5" opacity=".45"/><rect x="6" y="13" width="6" height="6" rx="1.5" opacity=".45"/><rect x="13" y="13" width="6" height="6" rx="1.5"/><rect x="20" y="13" width="6" height="6" rx="1.5" opacity=".45"/><rect x="6" y="20" width="6" height="6" rx="1.5" opacity=".45"/><rect x="13" y="20" width="6" height="6" rx="1.5" opacity=".45"/><rect x="20" y="20" width="6" height="6" rx="1.5" opacity=".45"/></g></svg>
<p id="status" role="status">Connecting…</p>
</main>
<footer>
<button type="button" id="open">Open saved papers</button>
<p>Papers saved on this phone open without internet.</p>
</footer>
<script>
document.getElementById('open').onclick = function () { location.href = '/saved'; };
if (navigator.serviceWorker) navigator.serviceWorker.onmessage = function (e) {
  if (!e.data || e.data.href !== location.href) return;
  if (e.data.type === 'yw-ready') location.replace(location.href);
  if (e.data.type === 'yw-failed') document.getElementById('status').textContent = 'No connection';
};
addEventListener('online', function () { location.reload(); });
</script>
</body></html>`;

function waitingPage() {
  return new Response(WAITING_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
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
