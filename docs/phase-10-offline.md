# Phase 10 — Home screen app and saved papers

Nov 4, 2026 · @Umer

> **Temporary file.** This is the working spec for Phase 10 only. In the PR that finishes the phase,
> move what still matters into `docs/spec.md` (section 8 pages and the lookup endpoint, section 9
> screens, states and accessibility, section 10 phase list, section 13 notes), add a Phase 10 entry
> to `docs/progress.md`, then **delete this file** and the pointer to it in spec section 10.

## 1. What this phase adds

1. **Add to home screen.** A manifest and icons, so youwho can be added to the home screen on Android and iPhone and opens full screen, like an app.
2. **Install ribbon.** On phones, a ribbon drops from under the masthead on the papers page. Tapping it opens a sheet that installs the app (Android) or shows how (iPhone).
3. **Saved papers.** Inside the installed app, the papers page has **Save to this device**. A saved number opens from the phone straight away and quietly updates itself from the server.

**People who never install the app see no change**, apart from the ribbon on their phone's papers page. Browser tabs get no service worker, no saving code and no extra request.

No new service, paid plan, runtime dependency or endpoint. The scraper is not touched.

## 2. Scope

### Saved on the phone

- The papers page only: the `GET /api/lookup` answer for that number (name, registration number, each department's papers and TBA courses, department label and update stamp).
- The offline page (`/saved`) and the static files it loads.

### Never saved (online only)

- Room views and seat grids, so no other student's name is ever on the phone.
- Department pages, the home board, admin, adding a department, Looks right and Report, seat search.

### Rules

- Saving is offered, never forced. Nothing is stored until the student taps Save.
- Saving and the saved view exist only in the installed app.
- **No loading or sync states.** A saved copy shows "Last updated 3 Nov, 6:00 PM" and nothing else. The refresh runs silently. If the server returns data, the copy is replaced, the papers on screen update in place and the time moves on. If it fails or the connection is slow or gone, nothing on screen changes.
- Staleness is accepted. There is no background refresh while the app is closed.

## 3. Add to home screen

| File | Content |
| --- | --- |
| `app/manifest.ts` | `name`/`short_name` youwho, `id`/`start_url`/`scope` `/`, `display: standalone`, `orientation: portrait`, `theme_color` `#2b2016` (Sand masthead, same as `viewport.themeColor`), `background_color` `#f4eee3` (Sand page) |
| `app/apple-icon.png` | 180 × 180, iPhone home-screen icon |
| `public/icons/icon-192.png`, `icon-512.png` | `purpose: any`, rounded tile |
| `public/icons/maskable-512.png` | `purpose: maskable`, mark inside the safe zone |

- The icon is the header's mark redrawn as nine chairs, as in the seat map, with the middle one amber ("you"), on the Sand masthead colour. The PNGs were rendered once with the Playwright already in the repo and committed; no image library was added.
- Root metadata: `appleWebApp: { capable: true, title: 'youwho', statusBarStyle: 'default' }`.
- A manifest cannot read CSS variables, so its two hex colours are the one exception to "colours only from theme variables"; a comment in `manifest.ts` says so.
- `proxy.ts` excludes `apple-icon.png`, `icons/`, `manifest.webmanifest` and `sw.js`, so they are served (and the kill switch still reaches phones) while the site is decommissioned.

## 4. Install ribbon

### Why our own

| Browser | What it does by itself |
| --- | --- |
| Chrome and Edge on Android | A small bottom bar, once; dismissed, it stays away about three months |
| Samsung Internet, desktop Chrome and Edge | An icon in the address bar only |
| Safari and every browser on iPhone | Nothing. The student has to know Share, then Add to Home Screen |

A toast would cover content on a small screen, so the suggestion is a ribbon in the page's flow.

### Look

- A band in the masthead colour, with a slight top-light gradient and a fine inner edge. It has notched tails behind both ends, sitting a little lower, with darker folds, like a game's reward ribbon. In Dusk the band is lifted a step lighter so the tails read against the dark page.
- Left: an amber disc with the **PhoneSave** icon (a phone with an arrow coming down into it). The same icon is used on Android and iPhone, in the sheet and on the save control, so "keep it on your phone" always looks the same.
- Text: **Add to Home Screen** over "Your papers, even offline", then a chevron. A divider, then a × button.
- Motion: drops out from behind the masthead with a slight overshoot (640 ms), then one light sweep across the band and two small nudges of the arrow. Closing lifts it back up, then the slot folds away. All motion is off under `prefers-reduced-motion`.
- Focus rings inside the ribbon are amber, because the brand blue disappears on navy.

### Behaviour

- **Server-decided** (`src/server/install.ts`). It is rendered only on `/r/[reg]` when all of these hold:
  - `OFFLINE_ENABLED` is on;
  - the user agent is a phone (iPhone, iPad or Android);
  - there is no `yw_ribbon` cookie (closed) and no `yw_app` cookie (installed).

  Because the server renders it, its space is in the first paint and only a transform animates, so nothing on the page jumps (no layout shift).
- CSS hides it under `@media (display-mode: standalone)`, so it never shows inside the app.
- **×** sets `yw_ribbon=closed` for 90 days, about Chrome's own back-off.
- Tapping the band opens the install sheet. Its code loads when the ribbon is first touched or hovered, not with the page.
- On Chromium, `beforeinstallprompt` is captured with `preventDefault()` (`src/client/install-prompt.ts`, started by `AppShell` in the layout), so the browser's own bar never appears next to ours. On `appinstalled` the ribbon closes for good.

### Install sheet (`src/ui/install-sheet.tsx`)

A Radix Dialog: bottom sheet on phones with a grab handle and safe-area padding, centred card from 40rem up. Esc, the overlay and × all close it.

- Top: the real app icon with "youwho" under it, as it will look on the home screen. Title "Add youwho to your Home Screen"; line "It opens full screen, like an app. Save your papers in it and they open even without internet."
- **Browser can install** (install event captured): one primary button, **Install youwho**, which opens the system dialog.
- **iPhone**: three numbered steps, with each control drawn like the key the student will see:
  1. Tap [Share] ("At the bottom of Safari. On newer iPhones it is under •••.")
  2. Choose [Add to Home Screen] ("Scroll down the list if you don't see it.")
  3. Tap [Add].
- **Other Android browsers**: the same three steps for the ⋮ menu, Add to Home screen (or Install app), then Install.
- Footer: "Then open youwho from your Home Screen and tap Save to this device on your papers."

## 5. Storage, offline page and service worker

### Saved data (`src/client/saved.ts`)

Cache Storage, so the page and the worker share it without IndexedDB.

| Cache | Key | Value |
| --- | --- | --- |
| `yw-saved-v1` | `/saved-data/{REG}.json` | `{ v: SAVED_FORMAT, reg, refreshedAt, data: LookupView }` |
| `yw-shell-v1` | `/saved` and the `/_next/static/…` files it references | The offline page |

- At most 5 saved numbers (`MAX_SAVED`). The first save calls `navigator.storage.persist()`; the answer is ignored.
- `SAVED_FORMAT` is bumped when `LookupView` changes shape. A copy in an older format is not rendered: "This saved copy is from an older version of youwho. Connect to the internet to update it." It is replaced on the next successful refresh.
- This module is the adapter for storage. Every storage failure is caught there and becomes a result value. Only `savePapers` turns a refused write into `DEVICE_STORAGE_FAILED`.
- `cacheShell()` runs after every save and refresh:
  1. Fetch `/saved` with `no-cache`, stopping on a redirect (a decommissioned site).
  2. Collect its same-origin `/_next/static/…` URLs.
  3. Add the missing ones, store the page, and delete files no longer referenced.

  A new deploy therefore reaches the offline page on the next refresh, with no build step.

### Offline page (`/saved`, `src/ui/saved-view.tsx`)

A client page with no server data, `noindex`. What it shows depends on the path it was opened at:

- **`/r/{REG}`, saved:** the same `StudentHeader` and `PaperList` as the live page (moved into `src/ui/paper-list.tsx` so the two cannot drift). The header has the saved strip: "Saved on this device", "Last updated 3 Nov, 6:00 PM" and **Remove**. Looks right and Report are hidden; papers still link to their rooms.
- **Anything else:** a card listing the saved numbers (initials, name, number, last updated). Offline its heading reads "You're offline" with "Search and room maps need a connection. Papers you saved still open."; online, "Saved on this device".

### Service worker (`public/sw.js`)

Hand-written, about 100 lines, no Workbox. Served with `Cache-Control: no-cache, no-store, must-revalidate`.

| Request | Behaviour |
| --- | --- |
| Navigation to `/r/{REG}`, saved | The cached `/saved` page at once (it then refreshes itself) |
| Any other navigation | Network; if that fails, the cached `/saved` page (the list); if that is missing too, the failure |
| `/_next/static/…` in `yw-shell-v1` | Cache first |
| Everything else, including `/api/*`, `/_vercel/*`, other origins and non-GET | Not touched |

- It never stores anything itself. Only `saved.ts` writes.
- `install` skips waiting; `activate` claims clients and deletes unknown `yw-*` caches.
- Registered by `AppShell` only when running standalone, and only after `load`. In a browser tab nothing registers.
- On Android the app and Chrome share an origin, so the worker also serves saved copies in Chrome tabs. This is accepted.

### Opening a saved number

- Any full navigation to `/r/{REG}` in the app (home search, a saved-list link, reopening the app) gets the offline page from the worker. The page renders the copy, then calls `GET /api/lookup?reg={REG}&refresh=1` with a 15 s timeout.
  - **Success:** the copy, the papers on screen and "Last updated" are replaced.
  - **Failure:** nothing visible happens. If the failure was a lost connection, the refresh runs once more on the `online` event.
  - **`SITE_DECOMMISSIONED`:** the copy is deleted and the app goes to `/`, which shows the notice.
- `RollForm`, inside the app only, lazily loads `saved.ts` and checks the typed number. If it is saved, it does a full navigation to `/r/{REG}` instead of calling the API, so it works offline and opens at once.
- A soft navigation that reaches the live `/r/[reg]` page in the app (for example, back from a room) shows the server's data with the saved strip, and the copy is refreshed quietly in the background.

### Kill switch

- `src/site-status.ts` has `OFFLINE_ENABLED`. When false, `AppShell` unregisters the worker and deletes every `yw-*` cache, and the ribbon and save control render nothing.
- `public/sw.js` has `RETIRED`. When true, the worker deletes its caches, unregisters and reloads its pages on activate.
- Set both and deploy to turn the feature off on phones that already have it.

## 6. Lookup endpoint: no new endpoint

`GET /api/lookup` takes an optional `refresh=1`. It returns the same answer, but uses `LookupService.lookup` instead of `search`, so refreshes and saves are not counted as searches in the lookup stats. Without the flag, behaviour is unchanged. Same rate limit (120 per IP per hour).

## 7. Papers page in the installed app

`SaveGate` (always on the page, a few lines) loads `SavePapers` only when standalone, so tabs download none of it. It renders as a strip under the student header, separated by a rule:

| State | Strip |
| --- | --- |
| Not saved | PhoneSave tile · **Keep these papers on your phone** / "They open even without internet. Room maps stay online only." · **Save to this device** (full width under the text on phones) |
| Saving | Button reads "Saving…" and is disabled |
| Saved | Green PhoneCheck tile (pops in) · **Saved on this device** / "Last updated 3 Nov, 6:00 PM" · **Remove** |
| 5 already saved | "5 numbers are saved on this device. Remove one to save this one." |
| Save failed | `ERROR_COPY` heading and message under the strip, as an alert |

Remove deletes the copy at once, without a confirmation, since saving again is one tap.

## 8. Errors

- New client-only code `DEVICE_STORAGE_FAILED`: "Couldn't save", "Couldn't save on this device. Free some space and try again.", retryable. It sits beside `NETWORK_ERROR` in `PublicError['code']` (`packages/errors/src/envelope.ts`); `ClientErrorCode` in `api-fetch.ts` is that type; copy is in `error-copy.ts`. It is not in the server catalog, because no server code can produce it.
- Refresh failures are not errors and show nothing.
- No `throw new Error`. Catches exist only in the storage adapter, the worker's network fallbacks and worker registration, each with a comment.

## 9. Non-functional requirements

These restate the bar the repo already meets. The phase is not done until all of them hold.

### UI and UX quality

- Premium, not bolted on: the ribbon, sheet and save strip use the existing tokens, radii, shadows, `.btn` and `.card` styles and the inline icon set. They are checked in Sand, Day and Dusk.
- Every new surface has considered motion (drop, sweep, sheet slide or pop, save pop), and none of it runs under `prefers-reduced-motion`.
- No layout shift: the ribbon's space comes with the server HTML, and the save strip exists only inside the app, where it eases in.
- Copy is short and literal. Times are in `Asia/Karachi` via `fmtStamp` ("3 Nov, 6:00 PM", never split across lines).
- 360 px: ribbon on one line, no horizontal scroll. Desktop: no ribbon.

### Performance

- Lighthouse (mobile, production build) stays at 100 accessibility and at least 99 performance on home, papers, department and room.
- Home JavaScript grows by under 2 KB gzipped. Always loaded: `AppShell` and the install-event store. Lazy: the ribbon's sheet, the save control, `saved.ts` (in the app only).
- The worker registers after `load`; pages it does not handle take the same network path as before.
- A saved copy paints from the phone without waiting for the network.
- One `GET /api/lookup?refresh=1` per open of a saved copy; no polling.

### Storage

- A few KB per saved number. The offline page and its files stay under 1 MB; about 2 MB at most in total.

### Reliability

- Online behaviour never depends on the worker: any error inside it falls back to the network. The kill switch removes it in one deploy.
- Blocked, full or OS-cleared storage degrades to "not saved"; nothing crashes.
- Old formats are detected by version and never rendered wrongly.
- A saved copy always shows when it was last updated.

### Compatibility

- Install and save: Chrome and Samsung Internet on Android; Safari on iOS 16.4+ and home-screen apps added from other iOS browsers.
- Elsewhere the features simply do not appear. Detection is by feature, apart from the server's phone check and the iPhone check that picks the Share steps (iPadOS is told apart by touch support).

### Accessibility

- The ribbon is a labelled region. The band is a button with `aria-haspopup="dialog"`; × is "Hide this suggestion"; neither takes focus by itself.
- The sheet is a Radix Dialog: focus is trapped and returned, it has a title and description, and steps are an ordered list.
- The save strip is a polite live region; a failed save is `role="alert"`.
- Targets are at least 44 px (ribbon band and ×, sheet buttons, save strip buttons). Text meets WCAG AA in all three themes.

### Privacy and security

- Only the student's own lookup, and only after they tap Save. No room data on the phone.
- Nothing about saving or installing is logged or sent to analytics.
- The worker handles same-origin GET only, never caches the API and never evaluates anything. Saved text is rendered as text.

### Code

- No new dependencies, no test framework. Named exports, files under 300 lines. Client code imports only `reg.ts` from `@youwho/core` (the index would pull in zod and acorn).
- `pnpm lint` and `pnpm typecheck` pass. `sw.js` has its own ESLint block with worker globals. `check:decoder` is not needed (core unchanged).

## 10. Files

| Area | Files |
| --- | --- |
| App shell | `app/manifest.ts`, `app/apple-icon.png`, `public/icons/*`, `app/layout.tsx` (metadata, `AppShell`), `src/ui/app-shell.tsx`, `proxy.ts`, `next.config.ts` |
| Ribbon | `src/server/install.ts`, `src/ui/install-ribbon.tsx`, `src/ui/install-sheet.tsx`, `src/client/install-prompt.ts`, `src/client/app-mode.ts` |
| Saving | `src/client/saved.ts`, `src/ui/save-gate.tsx`, `src/ui/save-papers.tsx`, `src/ui/saved-view.tsx`, `app/saved/page.tsx`, `public/sw.js`, `src/site-status.ts` |
| Shared | `src/ui/paper-list.tsx` (moved from the papers page), `src/ui/source-notice.tsx` (`actions`), `src/ui/roll-form.tsx`, `src/ui/format.ts` (`fmtStamp`), `src/ui/icons.tsx`, `app/globals.css` |
| API and errors | `src/server/schemas.ts`, `app/api/lookup/route.ts`, `packages/errors/src/envelope.ts`, `src/client/api-fetch.ts`, `src/ui/error-copy.ts`, `eslint.config.js` |

## 11. Check by hand

Use a production build (`next build && next start`, or a Vercel preview). Items 1, 2 and 5–8 need real phones.

1. Android Chrome: ribbon on the papers page, no Chrome bottom bar; the sheet's Install opens the system dialog; the app opens full screen with the chair icon.
2. iPhone Safari: the ribbon's sheet shows the three Share steps; after adding, the app opens full screen and the ribbon is gone inside it.
3. × hides the ribbon after reload (cookie). There is no ribbon on desktop, on home, department or room pages, or inside the app.
4. In a browser tab: no worker registered (DevTools → Application), no save strip, `/api/lookup` called only by search.
5. In the app: save a number, then use airplane mode and reopen the app. The saved papers show with "Last updated …" and nothing else.
6. Offline, tap a paper: the offline page says room maps need a connection and lists the saved numbers.
7. Back online, open the saved number: no spinner or message; "Last updated" moves; change the data on the server (re-seed) and the papers update in place.
8. Offline, search a saved number from home: it opens. Search an unsaved one: "No connection".
9. Remove: the strip returns to Save; offline the number is no longer listed.
10. Bump `SAVED_FORMAT`: the older-version line shows offline and is replaced online.
11. Rebuild, open a saved number online, then go offline: the offline page still loads.
12. Kill switch: `OFFLINE_ENABLED = false` and `RETIRED = true`, rebuild, open the app online: the worker and `yw-*` caches are gone.
13. Lighthouse on home, papers and room: scores as in section 9.
14. 360 px and desktop in Sand, Day and Dusk: ribbon, sheet and save strip fit without horizontal scroll.

Checked during the build (Playwright, emulated phones and an emulated installed app):
- the ribbon on iPhone and Android in all three themes, at 360 px with no horizontal scroll;
- the sheet;
- close and the cookie;
- no ribbon on desktop;
- save, with the worker registered and 17 shell files cached;
- offline open of a saved number, the offline list, and a list link opening the copy;
- offline home search;
- a background refresh calling `refresh=1`;
- Remove;
- tapping a paper offline.

Items 1, 2, 7 (data change), 10–13 are still to do.
