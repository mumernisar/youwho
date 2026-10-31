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

## Next: Phase 4 — Web read path
