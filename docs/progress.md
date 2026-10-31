# youwho — build progress

Phases follow spec section 10. Only big phases are logged here.

## Phase 0 — Repository and tooling: done
- pnpm 12 workspace (corepack), Node 22, layout from spec section 3 (`apps/web`, `apps/scraper`, five packages).
- TypeScript pinned to 6.0.3 (typescript-eslint does not support 7.x yet); strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- ESLint: `throw new Error` banned; per-package `no-restricted-imports` boundaries; client code cannot import db/notify/config/server.
- Prettier, `docker-compose.yml` (Postgres 16), spec copied to `docs/spec.md`, sample fixture and page script copied to `packages/core/fixtures/`.
- Checked: `pnpm lint` and `pnpm typecheck` pass; a client file importing `@youwho/db` or using `throw new Error` fails lint.

## Phase 1 — `errors` and `config`: done
- `packages/errors`: catalog (all codes from section 5), typed details, `AppError`, `fail`, `isAppError`, `toAppError`, `toPublic`, envelope types.
- `packages/config`: zod env schemas and `loadWebEnv` / `loadScraperEnv` (print every problem, exit 1); pino logger with redaction.
- Checked: missing variables print a readable list and exit 1; `toPublic` on a wrapped unknown error returns `INTERNAL` with no cause.

## Phase 2 — `core`: done
- `RawPlanSchema` + `parseRawPlan` (5 MB cap, JSON, shape, group-row format), decoder v1 and registry (`selectDecoder`), `normalizeReg`, `canonicalizeSourceUrl`, `slugFromSourceUrl`, slot keys, room slugs, seat labels, `roomDims`.
- `pnpm check:decoder`: 2,533 students with seats, 13,916 seats, 1 TBA-only, hash of the page script is the registered v1 hash, four hand-picked records match.
- Checked: a corrupted course index fails with `DATA_DECODE_FAILED` naming the student.
- Finding: three pairs of slots share a date and start time but differ in end time (80 vs 90 minute papers; e.g. `2026-11-03T08:30`). They use the same rooms with no seat collisions, so they are one physical session. Slot key stays `date + start` (the spec); the DB phase adds an `end_time` column to `seats` so a paper keeps its own end time.

## Phase 3 — `db`: done
- Drizzle schema + generated migration for every table in section 4 plus `rate_limits` and `scraper_status`. `seats` also stores `end_time`, and `room` is the room name (not an index).
- `createDb({ url, driver })` with Neon WebSocket pool (web) and postgres.js (scraper, max 2); connection failures become `DB_UNAVAILABLE` through `guard`.
- Repos: `DatasetRepo` (list, get, transactional replace-save, hard delete that also fails queued jobs), `SeatRepo` (lookup, room view, rooms), `JobRepo` (join-or-create, claim with skip locked, stage/finish/fail guarded by status, boot sweep, queue position), `FeedbackRepo` (confirm toggle, report-once-per-day, counters in the same transaction), `RateLimitRepo`, `ScraperStatusRepo`.
- Scripts: `pnpm db:migrate` and `pnpm seed:fixture` (local by default, `--neon` targets `NEON_DATABASE_URL`). Local Postgres is on port 5433 because 5432 was taken.
- Checked on local Postgres: seeding twice does not duplicate, a changed hash replaces rows; lookup, TBA-only student, room view and not-found errors work; confirm toggles from two voters keep the count right; duplicate-URL jobs join; claim is single-winner; rate limit cuts off at the limit; deleting a dataset empties students, seats, votes and reports. Migration and seed also ran against Neon.

## Phase 4 — Web read path: done
- Next.js 16 app (`apps/web`) with Tailwind 4, IBM Plex via `next/font`, Radix Dialog for the seat sheet. Local env: `apps/web/.env` is a symlink to the root `.env`.
- Server layer: composition root (`createServices`, memoized on `globalThis`), `route()` wrapper (request id, rate limit, input parsing, error mapping, voter cookie), `loadPage()` for server components, services (`LookupService`, `RoomService`, `DatasetService`), view types in `schemas.ts`.
- Client: `apiFetch`/`ClientError`, `ERROR_COPY` typed over every catalog code, a single `<ErrorState>`, theme switch with a cookie (no flash).
- Pages: `/` (roll field + board), `/r/[reg]` (normalizes and redirects), `/d/[slug]` (rooms with slot links), room view with course colours and textures, legend spotlight, seat dialog, arrow-key navigation, extra-chair strip and clash-room list. APIs: `/api/lookup`, `/api/datasets`, `/api/datasets/[slug]/rooms/[room]/[slotKey]`. Source notice is in place; Looks right and Report are disabled until Phase 7.
- Fixes found while testing: `AppError` now carries a brand so `isAppError` works when a bundler loads the errors package twice (SSR and route handlers); relative imports in packages lost their `.js` suffix because Turbopack does not map them to `.ts`; the lint rule for client code now allows type-only imports from `server/`.
- Checked: lookups with lowercase and no dashes redirect to the canonical form; bad and unknown numbers show the catalog message; unknown room or department gives 404; the room view carries your seat (`data-me`), labels like "Row 3, seat 5, CSC322 …"; `next build` passes. Visual check at phone width was only done with headless Chrome (minimum window width is wider than 360), so real 360 px and Paper/Chalkboard checks are left for you or Phase 9.

## Phase 5 — Scraper service: done
- `apps/scraper`: `PageSource` interface with `FixturePageSource` and `PlaywrightPageSource` (headless shell, blocked resource types and hosts, redirect-to-sign-in check, frame polling with scroll, 5 MB cap, abort closes the browser; gives up with `SOURCE_NO_DATA` after 45 s of not finding the data).
- Pipeline steps (`decodeStep`, `persistStep`), runner (claim with `skip locked`, deadline `JOB_LIMIT_MS`, serialised stage writes that refresh the heartbeat, hard exit 30 s after the deadline, boot sweep, single-flight drain), `node:http` server with `/health` and `/kick` (constant-time bearer check), composition root in `main.ts`, bundled with tsup into one file (runtime deps: `playwright`, `postgres`).
- Job `stage` values: `opening`, `extracting`, `checking`, `saving:<seat count>`. Fixture mode can simulate failures by URL (`missing-*`, `private-*`, `broken-*`, `unreachable-*`, `slow-*`).
- `packages/notify` now has the `Notifier` interface, event types and console notifier (Resend arrives in Phase 8). `@youwho/db` is split into subpaths (`/client`, `/postgres`, `/neon`) so the scraper never loads the Neon driver.
- Dockerfile (root context), `.dockerignore`, `render.yaml`, and `apps/scraper/dev/iframe-fixture` (three nested iframes across two origins).
- Checked locally: a fixture job reaches done; with `JOB_LIMIT_MS=5000` a slow job fails `SCRAPE_TIMEOUT` after 5.0 s and the next queued job still runs; every fixture error URL stores its catalog code; killing the process mid-job and restarting marks the job `SCRAPER_RESTARTED`; the Playwright source finds the data through the nested iframes; a real scrape of the CS Google Sites page succeeded both natively (5.2 s) and inside the Docker image under a 512 MB limit (4.8 s, about 192 MiB peak sampled).
- Not done (needs your Render account): deploying to Render and one real scrape from there.

## Next: Phase 6 — Add and refresh flow
