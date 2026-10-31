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

## Next: Phase 2 — `core`
Schema, decoder v1 and registry, URL/reg/slot/room helpers, `check:decoder`.
Notes: the web `ADMIN_TOKEN` minimum length (16) and `HASH_SALT`/`SESSION_SECRET` minimum (32) are my choices; the spec only fixes the 32-byte minimum for `SCRAPER_SECRET`.
