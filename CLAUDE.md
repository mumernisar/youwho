# youwho

Shows students who sits around them in an exam room, from department seating plans
published on Google Sites. Full spec: docs/spec.md (section numbers below refer to it).

## Stack
- pnpm workspaces, TypeScript strict, Node 22
- apps/web: Next.js App Router on Vercel, Tailwind, Radix primitives, cookie-based themes
- apps/scraper: node:http + Playwright headless shell on Render free (512 MB), built with tsup
- packages: errors, core, db (Drizzle, Neon), notify (Resend via fetch), config (zod env + pino)
- No test framework and no CI. Vercel and Render deploy from main.

## Commands
- pnpm dev              web + scraper (PAGE_SOURCE=fixture) + local Postgres via docker compose
- pnpm lint && pnpm typecheck
- pnpm check:decoder    decodes the fixture and checks known counts and records
- pnpm db:migrate       apply Drizzle migrations (run by hand against Neon before merging)
- pnpm seed:fixture     load the sample plan as a dataset

## How to work
- Build one phase at a time (spec section 10). One phase = one branch = one PR.
- Before coding a phase, re-read the spec sections it touches. If the spec is unclear
  or wrong, stop and ask; do not invent behaviour.
- Do not add a test framework, test files or CI workflows unless asked.
- At the end of a phase, run lint, typecheck and (if core changed) check:decoder,
  then list the phase's "Check by hand" steps for me to run.
- Keep commits small, Conventional Commits style (feat:, fix:, chore:, docs:).

## Rules
- Errors (section 5):
  - Create errors only with fail(code, ...). Never `throw new Error`.
  - Library errors are translated to AppError in the adapter that calls the library.
  - Catch only in boundary wrappers (route, scraper endpoint, job runner, apiFetch) or to translate.
  - New failure mode = new catalog entry + UI copy in error-copy.ts. Never reuse or rename a code.
- Boundaries (section 3):
  - Apps import packages, never the reverse. packages/core has no I/O and no Date.now().
  - Files in apps/web/src/server start with `import 'server-only'`.
  - Read config only through packages/config. Never read process.env elsewhere.
  - External services only through their interface + factory (Notifier, PageSource, ScraperClient).
- Data (section 4):
  - Validate page data for shape and type only. Do not add semantic checks.
  - Never edit decoder v1; a new page format gets a new decoder in the registry.
  - Use slot keys and room slugs in URLs, never array indexes.
- Privacy and security:
  - Never log student names, voter ids, IPs or secrets. Hash IPs and voter ids with HASH_SALT.
  - Never use dangerouslySetInnerHTML. All page-derived text is rendered as text.
  - Never execute or eval anything taken from a scraped page.
- UI (section 9):
  - Colours only from theme CSS variables. Every seat has an accessible label.
  - User-facing copy is short and literal. No jokes in status or error text.
- Free tier: no new paid services, no new runtime dependency in the scraper without a reason in the PR.

## Definition of done for any change
- Lint and typecheck pass; check:decoder passes if packages/core changed.
- No new lint suppressions without a comment explaining why.
- Spec updated in the same PR if behaviour changed.
