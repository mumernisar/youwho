# youwho — build spec

Oct 31, 2026 · @Anas

## 1. Overview and scope

youwho shows a student who is sitting around them in an exam room. Its exam data comes from department seating-plan pages published on Google Sites. The official page already gives each student their own room and seat; youwho adds the room view: every seat in the room, coloured by course, with your seat marked, and a tap on any seat showing that person's name and roll number.

This document is the build spec for Claude Code. Each section is self-contained so it can be handed over on its own, and section 10 orders the work into phases.

### In scope

| Feature | Summary |
| --- | --- |
| Roll lookup | Type a registration number, see your papers across every department on the board. |
| Room view | Seat grid for one room in one exam slot, your seat highlighted, seats coloured by course, tap a seat for name and roll number. |
| Department board | List of added departments, each with its source URL, update stamp and counts. |
| Add a department | Paste a Google Sites URL. If it is new, it is scraped on demand through a queue with live status. |
| Update a department | Re-scrape an existing department's URL. Goes through the same validation as a new one. |
| Reports and confirmations | Every user-added department shows a warning with its source. Users can report it or confirm it is correct. |
| Admin | The owner can delete a department and see reports. Email alerts through Resend. |
| Themes and star | Three colour themes and a Star on GitHub button with a live count. |

### Not in scope

- Invigilator or duty-roster data. It is not in the source.
- A list of neighbours outside the grid. The grid itself is the answer.
- A review or approval gate before a department goes live. Departments go live immediately; reports and admin delete handle mistakes.
- Scheduled or automatic re-scraping.
- Semantic checks on the data (date ranges, totals, double bookings). The source is official; only field shapes and types are validated.
- A class date-sheet view. The official page already has it.

### Fixed decisions

- Name: **youwho**, always lowercase.
- Hosting must stay free: web on Vercel Hobby, scraper on Render free, database on Neon free, email on Resend free.
- Each scrape job may run up to **3 minutes**. A job always ends as done or failed; it never stays stuck.
- Seat `R3-5` means row 3 counted from the front of the room, seat 5 counted from the left (the source page's own wording). The page does not say whose left; we read it as the invigilator's, standing at the front facing the students, so seat 1 is on the students' right. The drawing keeps the front at the top (as a student sees the room), so seat 1 is on the right of the screen, with "Front left" and "Back left" corner markers on that side. Directions such as "2 seats to your left" are from the student's seat facing the front. `SEATS_COUNT_FROM` in `apps/web/src/ui/room-model.ts` switches to the student's left if a real room shows otherwise.

### Reference sample

The extracted file `mid_term_seating_extracted.json` (CS mid-terms, 2–9 Nov 2026, stamp "31 Oct 2026") holds 2,534 students, 13,916 seats, 22 rooms, 33 slots and 313 course entries. One student has only to-be-announced papers and no seats. Commit a copy as `packages/core/fixtures/cs-fa26-mid.json`; the decoder check and the seed script use it.

## 2. Architecture and main flows

The web app on Vercel serves every page and every lookup straight from Neon. The scraper on Render is a separate, private service that only wakes for add and refresh jobs. The two share nothing but the database and a bearer secret.

&#91;embedded content: youwho architecture · 2 apps, 1 database, 3 external services\]

The browser talks only to the web app. The scraper reads the Google Sites page and writes results to Neon. Both apps can email the owner through Resend. The star count comes from the GitHub API, cached by the web app.

### Main flows

1. **Look up a roll number.** `/r/[reg]` normalizes the number, then `LookupService` reads that student's seats from every dataset in one query (index on `seats.reg`) and returns papers sorted by date and time.
2. **Open a room.** The room page asks `RoomService` for seats with matching `(dataset_id, slot_key, room)`, joined with student names, plus the room's dimensions and course list. One query, rendered on the server; only seat taps and the legend spotlight run in the browser.
3. **Add or refresh a department.** The sheet posts the URL to `/api/jobs`. The web app canonicalizes it and checks it against the board, active jobs, limits and cooldown, then inserts a job and kicks the scraper. The scraper claims the job, runs the pipeline and writes the dataset. The browser polls `/api/jobs/[id]` until done or failed (section 6).
4. **Confirm or report.** The source notice posts to the confirm or report endpoint. The row and its counter change in one transaction; a report also emails the owner.
5. **Delete.** The owner deletes from `/admin`. Cascades remove everything the dataset owns, and any queued job for its URL is failed.

## 3. Project structure and modularity

youwho is a pnpm-workspace monorepo with two apps and five packages. Domain logic lives in packages with no I/O; apps only wire things together. Every external service sits behind an interface built by a factory, so local development swaps in fakes (fixture page source, console notifier) with one environment variable.

### Layout

```
youwho/
  apps/
    web/                   Next.js App Router (Vercel)
      app/                 routes, layouts, error.tsx / not-found.tsx per segment
      src/server/          services, composition root, route wrapper  (server-only)
      src/client/          apiFetch, hooks (job polling, confirm)
      src/ui/              components, error copy, theme tokens
    scraper/               Node 22 service (Render, Docker)
      src/pipeline/        steps: openPage, extract, decode, persist, notify
      src/sources/         PageSource implementations (playwright, fixture)
      src/runner/          queue claim, job runner, deadline, sweeps
      src/http/            /health, /kick
      src/main.ts          composition root
      dev/iframe-fixture/  local nested-iframe site for developing the Playwright source
  packages/
    errors/                error catalog, AppError, factory, envelope   (no deps)
    core/                  raw schema, decoder registry, url, seat geometry, types  (no I/O)
      fixtures/            cs-fa26-mid.json and its logic script
    db/                    Drizzle schema, migrations, client factory, repositories
    notify/                Notifier interface, Resend + console implementations, email templates
    config/                zod env schemas: loadWebEnv(), loadScraperEnv(); shared pino logger
  scripts/                 check-decoder.ts, seed-fixture.ts
  tooling/                 tsconfig.base.json, eslint config
  docker-compose.yml       local Postgres
```

### Dependency rules

Arrows point one way: apps depend on packages, never the reverse. `errors` depends on nothing; `core` depends only on `errors` and `zod`; `db` and `notify` may depend on `core` and `errors`; `config` depends on `zod` and `pino`, and builds the shared logger. Enforce it with ESLint `no-restricted-imports` rules per package, so a violation shows in the editor and fails `pnpm lint`.

- Anything under `apps/web/src/server` starts with `import 'server-only'`. Client components never import `db`, `notify` or `config`.
- Library errors (zod, postgres, Playwright, fetch) never cross a package boundary. The adapter that calls the library converts them to `AppError` (section 5).
- `core` stays pure: no `Date.now()`, no network, no environment. Time comes in as an argument.

### Patterns used

| Concern | Pattern | Where |
| --- | --- | --- |
| Wiring | Composition root: one `createServices(env)` per app returns every dependency. Web memoizes it per server instance; scraper builds it in `main.ts`. | `apps/*/src/server/services.ts`, `apps/scraper/src/main.ts` |
| External services | Interface + factory picking the implementation from config: `createNotifier(env)` returns Resend or console; `createPageSource(env)` returns Playwright or fixture. | `packages/notify`, `apps/scraper/src/sources` |
| Data access | Repository per aggregate (`DatasetRepo`, `SeatRepo`, `JobRepo`, `FeedbackRepo`). Repos return domain types, never Drizzle rows. | `packages/db/src/repos` |
| Decoding | Registry keyed by the hash of the page's own decoder script. Unknown hash falls back to the latest decoder and raises a warning. | `packages/core/src/decoders` |
| Errors | Catalog + factory + boundary wrappers (section 5). | `packages/errors`, route and job wrappers |
| Time and cancellation | `Clock` interface and `AbortSignal` passed into every long step, so every long step honours the job deadline. | `core`, scraper runner |

Keep services thin: a service method validates input, calls repos and other services, and returns a domain type. No HTTP or React concepts below the route layer.

### Configuration

Each app parses its environment once at startup with a zod schema from `packages/config`. A missing or malformed variable stops the process with a list of what is wrong; nothing reads `process.env` elsewhere.

| Variable | App | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | web, scraper | Neon connection string, `sslmode=require` |
| `SCRAPER_URL` | web | Base URL of the Render service |
| `SCRAPER_SECRET` | web, scraper | Shared bearer secret for `/kick`, at least 32 random bytes |
| `ADMIN_TOKEN` | web | Owner login secret for `/admin` |
| `SESSION_SECRET` | web | Signs the admin session and voter cookies |
| `HASH_SALT` | web | Salt for hashing IPs and voter ids |
| `RESEND_API_KEY` | web, scraper | Email delivery; absent means console notifier |
| `OWNER_EMAIL` | web, scraper | Where owner alerts go |
| `NOTIFY_FROM` | web, scraper | Verified sender, e.g. `youwho <alerts@yourdomain>` |
| `GITHUB_REPO` | web | `owner/name` for the star button |
| `GITHUB_TOKEN` | web | Optional, raises the API rate limit for the star count |
| `PAGE_SOURCE` | scraper | `playwright` (default) or `fixture` for local development |
| `JOB_LIMIT_MS` | scraper | Job time limit, default 180000 (3 minutes); lower it locally to check the timeout path |

## 4. Data model, decoder and validation

Validation checks only that each field exists and has the right type and format; everything the decoder needs to run safely is checked, and nothing else. The source is the department's own page, so semantic checks such as date ranges, totals or double bookings are out of scope.

### Source format (what the page embeds)

The page holds a `<script type="application/json" id="data">` with these top-level fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `stamp` | string | Update stamp shown on the page, e.g. "31 Oct 2026" |
| `slots` | `[date, start, end][]` | Exam slots: `YYYY-MM-DD`, `HH:MM`, `HH:MM` |
| `kinds` | `[code, title, teacher?][]` | Course entries; teacher may be missing |
| `cls` | string\[\] | Class/section labels; `—` is used as a placeholder |
| `rooms` | string\[\] | Room names, including `Clash Room` |
| `special` | string\[\] | Non-grid seat labels: `Extra-N`, `CR-NN 1st HH:MM-HH:MM` |
| `groups` | `Record<prefix, string>` | Students per registration prefix, e.g. `FA23-BSE` |
| `classes` | array | Class date sheets. Not used; ignored. |
| `tba` | `Record<reg, [code, title, teacher][]>` | Optional. Papers not yet scheduled. |
| `totals` | `{students, seats}` | Counts the page displays |

Each `groups` value is `;`-separated rows of `roll|name|homeClass|seatCode`. `homeClass` is a 2-character base-36 index into `cls`. `seatCode` is a run of entries, each:

1. slot: 1 char base-36 index into `slots`
2. course: 2 chars, index into `kinds`
3. room: 1 char, index into `rooms`
4. seat: either `~` + 2 chars indexing `special`, or 2 chars giving row then seat, each 1 char base-36
5. optional `.` + 2 chars: section index into `cls`, when the student sits with another section

The registration number is `${prefix}-${roll}`, e.g. `FA23-BSE` + `118` → `FA23-BSE-118`.

### Validation rules

Implement as one zod schema, `RawPlanSchema`, in `packages/core/src/schema.ts`, followed by the decoder's own index checks. Any failure becomes a `DATA_SHAPE_INVALID` or `DATA_DECODE_FAILED` error carrying the path that failed (section 5).

| Check | Why it stays |
| --- | --- |
| Raw text at most 5 MB before parsing | Protects the 512 MB scraper from a hostile page |
| Every field above has its declared type; arrays and tuples have the right arity | The decoder and UI depend on it |
| Dates match `YYYY-MM-DD` and parse; times match `HH:MM` | Used for sorting and display |
| Strings at most 300 characters | Keeps a hostile page from storing huge text |
| Each `groups` row has exactly 4 \` | ` -separated fields, roll is digits, seat code is  `\[0-9a-z\~.\]\*\` |
| Every decoded index is inside its array; a seat code never ends mid-entry | Otherwise the decoder reads `undefined` |
| `totals` mismatch with decoded counts | Recorded as a **warning** on the dataset, never a failure |

Removed on purpose: character allow-lists for names and titles (React escapes all text), exam date span, duplicate seat detection, double-booking, totals equality and seatless-student checks.

Special seat labels are parsed leniently. `Extra-N` becomes an extra chair, `CR-NN 1st|2nd|3rd HH:MM-HH:MM` becomes a clash-room sitting, and any other string is kept as a plain label shown in a list.

### Decoder registry

The page also carries its own rendering script. The scraper hashes it (SHA-256 of the text with all whitespace removed) and looks the hash up in `decoders/index.ts`:

```ts
export interface PlanDecoder {
  version: string;                 // "v1"
  logicHashes: readonly string[];  // page scripts this decoder was written against
  decode(raw: RawPlan): DecodedPlan;
}
export function selectDecoder(logicHash: string): { decoder: PlanDecoder; known: boolean };
```

`v1` is registered with hash `3fc3416ed7a3fe6fc2e05c9096264fa7cd52df5b5e2c6e1d34defe7b14e7a0c4` from the sample page. An unknown hash still uses the latest decoder; the dataset records `decoderKnown: false` and the owner gets an email. A new format means adding `v2` beside `v1`, never editing `v1`.

### Normalized types

```ts
type SlotKey = string;                   // "2026-11-03T14:30-15:50", stable across re-scrapes
interface Slot { key: SlotKey; date: string; start: string; end: string }
interface Course { code: string; title: string; teacher: string | null }
type SeatPosition =
  | { kind: 'grid'; row: number; col: number }        // row from front, col from left, 1-based
  | { kind: 'extra'; n: number }
  | { kind: 'clash'; label: string; order: 1 | 2 | 3; start: string; end: string }
  | { kind: 'other'; label: string };
interface DecodedSeat { reg: string; slot: number; course: number; section: number; room: number; position: SeatPosition }
interface DecodedPlan {
  meta: { stamp: string; slots: Slot[]; courses: Course[]; sections: string[]; rooms: string[];
          roomDims: Record<number, { rows: number; cols: number }>; tba: Record<string, Course[]> };
  students: { reg: string; name: string; homeSection: number }[];
  seats: DecodedSeat[];
  warnings: string[];
}
```

`roomDims` is the largest row and column seen for each room across all slots, so a room keeps one shape in every slot. Use slot keys and room names in URLs, never array indexes: indexes can shift when a page is re-scraped.

### Database (Neon Postgres, Drizzle)

| Table | Key columns | Notes |
| --- | --- | --- |
| `datasets` | `id`, `slug` unique, `label`, `source_url` unique (canonical), `stamp`, `meta` jsonb, `data_hash`, `logic_hash`, `decoder_known`, `warnings` jsonb, `students_count`, `seats_count`, `confirm_count`, `report_count`, `created_at`, `updated_at` | Live as soon as the first scrape succeeds |
| `students` | `(dataset_id, reg)` PK, `name`, `home_section` | Index on `reg` for lookups across datasets |
| `seats` | `dataset_id`, `reg`, `slot_key`, `course`, `section`, `room`, `pos_kind`, `row`, `col`, `label` | Index `(dataset_id, slot_key, room)` for the room view, `(reg)` for lookup |
| `jobs` | `id` uuid, `source_url`, `kind` add/refresh, `dataset_id`, `status`, `stage`, `error_code`, `error_message`, `requester_hash`, `created_at`, `started_at`, `heartbeat_at`, `finished_at` | Partial unique index on `source_url` where status is queued or running |
| `confirmations` | `(dataset_id, voter_hash)` PK, `created_at` | One per voter per dataset; toggling deletes the row |
| `reports` | `id`, `dataset_id`, `reason`, `note`, `voter_hash`, `created_at` | Reason enum: wrong\_source, outdated, wrong\_data, other |

All child tables use `on delete cascade` from `datasets`, so deleting a dataset removes its students, seats, confirmations and reports in one statement. `jobs.dataset_id` uses `on delete set null`. `confirm_count` and `report_count` are updated in the same transaction as the row change, so the board never needs an aggregate query.

A re-scrape replaces a dataset's students and seats inside one transaction. If `data_hash` is unchanged, only `updated_at` moves.

## 5. Error handling

Every failure in youwho is an `AppError` with a stable code from one catalog. Adapters turn library errors into catalog errors at the boundary; four boundary wrappers (HTTP route, scraper endpoint, job runner, client fetch) turn catalog errors into responses, job records or UI. Adding a failure mode means adding one catalog entry; no handler code changes.

### The catalog

`packages/errors/src/catalog.ts` is the single source of truth. Each entry says how the error behaves everywhere it can surface.

```ts
export type ErrorCategory = 'input' | 'not_found' | 'limit' | 'auth' | 'source' | 'data' | 'unavailable' | 'internal';

export interface ErrorDef {
  status: number;          // HTTP status when it reaches an API response
  category: ErrorCategory;
  message: string;         // default user-facing text: plain, specific, no jargon
  retryable: boolean;      // the UI offers "Try again" only when true
  expose: boolean;         // false: the client sees INTERNAL instead
  log: 'info' | 'warn' | 'error';
}

export const ERRORS = {
  INVALID_INPUT:          { status: 400, category: 'input', message: 'Some of that input is not valid.', retryable: false, expose: true, log: 'info' },
  INVALID_REG_NUMBER:     { status: 400, category: 'input', message: 'That is not a registration number. Type it like FA24-BSE-058.', retryable: false, expose: true, log: 'info' },
  INVALID_SOURCE_URL:     { status: 400, category: 'input', message: 'Paste the link of a public Google Sites page.', retryable: false, expose: true, log: 'info' },
  STUDENT_NOT_FOUND:      { status: 404, category: 'not_found', message: 'No seats found for that registration number.', retryable: false, expose: true, log: 'info' },
  DATASET_NOT_FOUND:      { status: 404, category: 'not_found', message: 'That department is not on the board.', retryable: false, expose: true, log: 'info' },
  ROOM_SLOT_NOT_FOUND:    { status: 404, category: 'not_found', message: 'Nobody is seated in that room at that time.', retryable: false, expose: true, log: 'info' },
  JOB_NOT_FOUND:          { status: 404, category: 'not_found', message: 'That request no longer exists.', retryable: false, expose: true, log: 'info' },
  RATE_LIMITED:           { status: 429, category: 'limit', message: 'Too many requests. Wait a little and try again.', retryable: true, expose: true, log: 'info' },
  QUEUE_FULL:             { status: 503, category: 'limit', message: 'The scraper queue is full. Try again in a few minutes.', retryable: true, expose: true, log: 'warn' },
  REFRESH_COOLDOWN:       { status: 429, category: 'limit', message: 'This department was updated a few minutes ago.', retryable: true, expose: true, log: 'info' },
  UNAUTHORIZED:           { status: 401, category: 'auth', message: 'You are not signed in.', retryable: false, expose: true, log: 'warn' },
  SOURCE_UNREACHABLE:     { status: 502, category: 'source', message: 'That page could not be opened.', retryable: true, expose: true, log: 'warn' },
  SOURCE_NOT_PUBLIC:      { status: 422, category: 'source', message: 'That page is not public. It asks for a sign-in.', retryable: false, expose: true, log: 'info' },
  SOURCE_NO_DATA:         { status: 422, category: 'source', message: 'No seating plan was found on that page.', retryable: false, expose: true, log: 'info' },
  SOURCE_TOO_LARGE:       { status: 422, category: 'source', message: 'The seating data on that page is too large.', retryable: false, expose: true, log: 'warn' },
  SCRAPE_TIMEOUT:         { status: 504, category: 'source', message: 'Reading that page took longer than 3 minutes.', retryable: true, expose: true, log: 'warn' },
  DATA_INVALID_JSON:      { status: 422, category: 'data', message: 'The seating data on that page is not readable.', retryable: false, expose: true, log: 'warn' },
  DATA_SHAPE_INVALID:     { status: 422, category: 'data', message: 'The seating data is not in the expected format.', retryable: false, expose: true, log: 'warn' },
  DATA_DECODE_FAILED:     { status: 422, category: 'data', message: 'The seating data could not be decoded.', retryable: false, expose: true, log: 'warn' },
  SCRAPER_RESTARTED:      { status: 503, category: 'unavailable', message: 'The scraper restarted during this job. Please try again.', retryable: true, expose: true, log: 'warn' },
  SCRAPER_STALLED:        { status: 503, category: 'unavailable', message: 'The scraper stopped responding. Please try again.', retryable: true, expose: true, log: 'error' },
  SCRAPER_UNAVAILABLE:    { status: 503, category: 'unavailable', message: 'The scraper could not be reached. Please try again later.', retryable: true, expose: true, log: 'error' },
  DB_UNAVAILABLE:         { status: 503, category: 'unavailable', message: 'youwho is having trouble right now. Please try again.', retryable: true, expose: true, log: 'error' },
  INTERNAL:               { status: 500, category: 'internal', message: 'Something went wrong on our side.', retryable: true, expose: true, log: 'error' },
} as const satisfies Record<string, ErrorDef>;

export type ErrorCode = keyof typeof ERRORS;
```

Codes are part of the public API contract: never rename or reuse one. Messages may be reworded freely.

### Typed details per code

Some codes carry structured details; the type system forces the right shape.

```ts
export interface ErrorDetails {
  INVALID_INPUT: { issues: { path: string; message: string }[] };
  DATA_SHAPE_INVALID: { issues: { path: string; message: string }[] };
  DATA_DECODE_FAILED: { reg?: string; offset?: number; reason: string };
  RATE_LIMITED: { retryAfterSec: number };
  REFRESH_COOLDOWN: { retryAfterSec: number };
  DATASET_NOT_FOUND: { slug: string };
  SOURCE_UNREACHABLE: { httpStatus?: number };
}
type DetailsOf<C extends ErrorCode> = C extends keyof ErrorDetails ? ErrorDetails[C] : undefined;
```

### AppError and the factory

```ts
export class AppError<C extends ErrorCode = ErrorCode> extends Error {
  readonly code: C;
  readonly def: (typeof ERRORS)[C];
  readonly details: DetailsOf<C>;
  constructor(code: C, opts: { details?: DetailsOf<C>; message?: string; cause?: unknown } = {}) {
    super(opts.message ?? ERRORS[code].message, { cause: opts.cause });
    this.name = 'AppError';
    this.code = code;
    this.def = ERRORS[code];
    this.details = opts.details as DetailsOf<C>;
  }
  toPublic(requestId?: string): PublicError { /* see envelope */ }
}

// The only way code creates errors:
export const fail = <C extends ErrorCode>(code: C, ...args: DetailsOf<C> extends undefined
  ? [opts?: { message?: string; cause?: unknown }]
  : [opts: { details: DetailsOf<C>; message?: string; cause?: unknown }]): never => {
  throw new AppError(code, args[0] ?? {});
};

export const isAppError = (e: unknown, code?: ErrorCode): e is AppError =>
  e instanceof AppError && (code === undefined || e.code === code);

// Normalizer used by every boundary: anything unknown becomes INTERNAL, keeping the cause.
export const toAppError = (e: unknown): AppError =>
  e instanceof AppError ? e : new AppError('INTERNAL', { cause: e });
```

Rules for using it:

- Throw `AppError` via `fail()` everywhere. Do not return error values from some functions and throw from others.
- Never `throw new Error(...)` in application code. Lint for it with a `no-restricted-syntax` rule.
- Catch only at boundaries, or to translate. A `catch` that neither rethrows an `AppError` nor sits in a boundary wrapper fails review.
- Always pass the original error as `cause`, so logs keep the stack.

### Adapter translation (library → catalog)

Each adapter owns a small `translate` function so library knowledge stays in one place.

| Adapter | Library error | Becomes |
| --- | --- | --- |
| `core/schema` | `ZodError` on page data | `DATA_SHAPE_INVALID` with issue paths |
| `web/route` | `ZodError` on request input | `INVALID_INPUT` with issue paths (or the specific input code the schema names) |
| `core/decoders` | out-of-range index, truncated code | `DATA_DECODE_FAILED` with `reg` and `offset` |
| `db` | connection refused, timeout, Neon cold-start failure | `DB_UNAVAILABLE` |
| `db` | unique violation on the active-job index | resolved by the repo as "join the existing job", not an error |
| `sources/playwright` | navigation timeout, net error | `SOURCE_UNREACHABLE` |
| `sources/playwright` | redirect to accounts.google.com | `SOURCE_NOT_PUBLIC` |
| `sources/playwright` | `AbortError` from the job deadline | `SCRAPE_TIMEOUT` |
| `web/scraperClient` | fetch failure or non-2xx on `/kick` | `SCRAPER_UNAVAILABLE`, logged; the job stays queued |
| `notify/resend` | any failure | logged at warn and swallowed: a notification never fails a request or a job |

### Boundary wrappers

**HTTP route (web).** Every API route is built with one factory, so parsing, error mapping, logging and request ids are identical everywhere:

```ts
export const route = <I, O>(opts: {
  input?: z.ZodType<I>;              // parsed from query or JSON body
  auth?: 'admin';
  rateLimit?: RateLimitPolicy;
  handler: (ctx: { input: I; services: Services; req: NextRequest; requestId: string; voter: VoterId }) => Promise<O>;
}) => async (req: NextRequest, params: unknown): Promise<Response> => {
  const requestId = crypto.randomUUID();
  try {
    /* auth → rate limit → parse input → handler */
    return Response.json({ ok: true, data: await opts.handler(ctx) });
  } catch (e) {
    const err = toAppError(e);
    logError(err, { requestId, route: req.nextUrl.pathname });
    return Response.json({ ok: false, error: err.toPublic(requestId) }, { status: err.def.status, headers: retryHeaders(err) });
  }
};
```

**Pages (server components).** Services throw `AppError`. A helper converts `not_found` codes into Next's `notFound()`; anything else bubbles to the segment's `error.tsx`, which renders `<ErrorState>` from the code. Never let a raw stack reach the page.

**Scraper endpoints.** The same pattern as `route`, smaller: auth check, handler, `toAppError`, JSON envelope.

**Job runner.** The runner wraps each job in one try/catch. On failure it stores `error_code` and `error_message` (the catalog message, or a safe override) on the job row and sets status `failed`. The UI renders job failures with the exact same catalog copy as API failures. Unexpected errors are stored as `INTERNAL`; their cause goes only to logs.

**Client fetch.** `apiFetch<T>()` is the only way the browser calls the API. It returns `data` on `ok: true`, and on `ok: false` throws a `ClientError` rebuilt from the envelope (code, message, retryable, details). A network failure becomes the client-only code `NETWORK_ERROR`. Components never read `response.status`.

### Envelope

```ts
type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: PublicError };

interface PublicError {
  code: ErrorCode | 'NETWORK_ERROR';
  message: string;
  retryable: boolean;
  details?: unknown;   // only for codes with typed details
  requestId?: string;  // shown in small print on error screens for support
}
```

`toPublic()` returns `INTERNAL` with its default message when `expose` is false, and never includes `cause` or stacks.

### UI mapping

`apps/web/src/ui/error-copy.ts` maps each code to its presentation: icon, heading, and primary action (`retry`, `edit-input`, `go-home`, `add-department`, `none`). It is typed `Record<ErrorCode | 'NETWORK_ERROR', ErrorPresentation>`, so a new catalog code fails the type check until it has UI copy. `<ErrorState error={…} onRetry={…} />` is the single component that renders any error: inline, in a sheet, or as a full page.

### Logging

Use `pino` with a shared base config from `packages/config/src/log.ts`. Log level comes from the catalog entry. Every log line carries `requestId` or `jobId`, `code`, and for `error` level the serialized cause. Never log student names, full registration numbers at info level, voter ids, IPs, or secrets; redact `authorization` and cookie headers.

## 6. Scraper service and job lifecycle

The scraper runs one job at a time, gives each job up to 3 minutes, and guarantees every job ends as `done` or `failed`. The queue lives in Postgres, so nothing is lost when Render puts the free instance to sleep or restarts it.

&#91;embedded content: job lifecycle · 4 states, 5 ways to fail\]

A job waits in `queued` until the runner claims it, moves through four visible stages in `running`, and ends in `done` or `failed`. No path leads back: a retry is a new job.

### Job kinds and deduplication

- **add**: a URL not yet on the board. On success it creates the dataset.
- **refresh**: a URL already on the board. Same pipeline and the same validation; on success it replaces that dataset's data. Allowed once per dataset every 10 minutes (`REFRESH_COOLDOWN`).
- Submitting a URL that has an active (queued or running) job returns that job instead of creating a second one. A partial unique index on `jobs(source_url) where status in ('queued','running')` guarantees this even under concurrent submits.
- Submitting an `add` for a URL already on the board returns the dataset, not a job.

### Pipeline

A job is a fixed sequence of small functions. Each takes typed input and an `AbortSignal`, and returns typed output. The runner calls them in order and records the stage before each one.

| Stage shown to the user | Step | Input → output | Fails with |
| --- | --- | --- | --- |
| Opening page | `openPage` | URL → loaded page handle | `SOURCE_UNREACHABLE`, `SOURCE_NOT_PUBLIC` |
| Finding seating data | `extract` | page → `{ dataText, logicText, title }` | `SOURCE_NO_DATA`, `SOURCE_TOO_LARGE` |
| Checking data | `decode` | text → `DecodedPlan` + warnings | `DATA_INVALID_JSON`, `DATA_SHAPE_INVALID`, `DATA_DECODE_FAILED` |
| Saving N seats | `persist` | plan → dataset id, changed flag | `DB_UNAVAILABLE` |
| (silent) | `notify` | event → nothing | never fails the job |

`openPage` and `extract` live behind the `PageSource` interface:

```ts
export interface PageSource {
  read(url: string, signal: AbortSignal): Promise<{ dataText: string; logicText: string; title: string }>;
}
// createPageSource(env): 'playwright' → PlaywrightPageSource, 'fixture' → FixturePageSource(dir)
```

`FixturePageSource` returns files from disk, so the whole pipeline runs locally without a browser.

### PlaywrightPageSource

1. Launch Chromium's headless shell (`npx playwright install --only-shell chromium`) with `--disable-dev-shm-usage --disable-gpu --no-zygote --renderer-process-limit=2`. One browser per job, closed in `finally`, so memory returns to baseline between jobs.
2. Block every request whose resource type is image, media, font, stylesheet, websocket or manifest, and every host outside `google.com`, `gstatic.com`, `googleusercontent.com` and `googleapis.com`. Block service workers, downloads, popups and dialogs.
3. Navigate with `waitUntil: 'domcontentloaded'`. If the final host is not `sites.google.com`, fail with `SOURCE_NOT_PUBLIC`.
4. Poll `page.frames()` every 750 ms. In each frame, evaluate a function that finds `script#data` with `type="application/json"` and returns its `textContent` (or a too-large marker over 5 MB) plus the text of the script that reads it. Scroll the top page every few polls in case the embed loads lazily. The search walks every frame regardless of nesting depth or origin.
5. Aborting the signal closes the browser immediately, which unwinds any pending Playwright call.

Nothing from the page is ever executed in Node: only strings cross back.

### Runner, deadline and stuck-proofing

- **Claim.** `update jobs set status='running', started_at=now(), heartbeat_at=now() where id = (select id from jobs where status='queued' order by created_at limit 1 for update skip locked) returning *`.
- **Deadline.** The runner creates an `AbortController` and a timer of `JOB_LIMIT_MS` (3 minutes by default). On expiry it aborts, which closes Chromium, and the job fails with `SCRAPE_TIMEOUT`. A save already in progress may finish its transaction; a save not yet started is skipped.
- **Heartbeat.** Every stage change updates `heartbeat_at`.
- **Hard exit.** If cleanup itself has not finished 30 seconds after the deadline, the process exits with code 1 and Render restarts it.
- **Boot sweep.** On start, any job still `running` belonged to a dead process and is failed with `SCRAPER_RESTARTED`. Then the runner drains the queue.
- **Web-side sweep.** The job status endpoint fails a `running` job whose heartbeat is older than 4 minutes (`SCRAPER_STALLED`) and a `queued` job older than 15 minutes (`SCRAPER_UNAVAILABLE`). This covers a scraper that died without restarting.
- Failures are written with `where status = 'running'`, so a late write from a timed-out job can never overwrite a sweep.

### Waking the free instance

Render's free service sleeps after 15 minutes without requests and takes roughly 30–60 seconds to wake.

1. When the Add a department sheet opens, the browser asks the web app to ping the scraper's `/health`. The scraper starts waking while the user is still pasting.
2. After inserting a job, the web app calls `POST /kick` with the bearer secret. A failed kick is logged and ignored; the job stays queued.
3. While a job is queued, each status poll re-sends `/kick` at most once every 15 seconds. The UI shows "Waking up scraper…" until the job moves to running.
4. `/health` and `/kick` both start a drain, and draining is idempotent, so extra pings are harmless.

### Queue position

Position is the number of `queued` jobs created before this one, plus one if a job is `running`. The status endpoint returns it; the UI shows "In line, 2 ahead of you" and switches to the stage text once the job is running.

### Limits

| Limit | Value | Error |
| --- | --- | --- |
| Jobs per requester per hour | 3 | `RATE_LIMITED` |
| Queued jobs in total | 20 | `QUEUE_FULL` |
| Refresh per dataset | once per 10 minutes | `REFRESH_COOLDOWN` |
| Job runtime | 3 minutes | `SCRAPE_TIMEOUT` |
| Raw data size | 5 MB | `SOURCE_TOO_LARGE` |

### Staying inside 512 MB

Run Node with `--max-old-space-size=160`. Use `node:http` instead of a framework, the `postgres` driver with at most 2 connections, and plain `fetch` for Resend. Build with `tsup` into a single file and keep runtime dependencies to `playwright` and `postgres`. The Docker image starts from `node:22-bookworm-slim` and installs only the headless shell.

## 7. Sources, reports, confirmations and admin

Departments go live as soon as they are scraped. Trust comes from showing where the data came from, letting users report or confirm it, and letting the owner delete it. The owner hears about everything that matters by email through Resend.

### Source attribution

Every place a department appears shows its source URL as a link (`rel="noopener noreferrer nofollow"`, opens in a new tab): the board card, the department page, the roll results header for that department, and the room view footer. Display the URL without `https://` and truncate the middle on narrow screens.

The department page and the room view also show this notice, above the content:

> This department's data was added by a user. Report it if you believe it came from the wrong source. Source of data: sites.google.com/view/cs-mid-term-fa26-students

The notice has two actions beside it: **Looks right · 12** and **Report**. On the roll results page, show a one-line version (source link plus the two actions) under each department heading.

### Confirmations ("Looks right")

- A toggle. Pressing it again removes the confirmation.
- One per voter per dataset, enforced by the `(dataset_id, voter_hash)` primary key.
- The voter id is a random UUID in an httpOnly, SameSite=Lax cookie `yw_vid` that lasts one year. Store only `sha256(HASH_SALT + vid)`.
- `confirm_count` changes in the same transaction as the row. The UI updates optimistically and rolls back on error.
- Limit: 30 toggles per voter per hour, and at most 5 new confirmations per IP address per dataset per day (removing one does not count). A cap, not one per IP, because campus wifi and mobile carriers share addresses.

### Reports

- The Report sheet asks for a reason (Wrong source page, Out of date, Seats look wrong, Something else) and an optional note up to 500 characters.
- One report per voter per dataset per day; a second one within a day updates the first. IP limits: 10 reports per hour, and 3 per IP address per dataset per day.
- Each report increments `report_count` and emails the owner. Looks right votes never send email.
- The board never hides or reorders a department because of reports. The owner decides.

### Admin

`/admin` is a separate page only the owner uses: sign in with the secret token, select departments, and delete them after one confirmation. Nothing else lives there.

**Sign in.** The page shows one password field. The server compares the value with `ADMIN_TOKEN` in constant time and, on a match, sets a signed, httpOnly, Secure, SameSite=Strict session cookie valid for 7 days. The token exists only in the server environment: it is read through `packages/config` in server-only code, never prefixed `NEXT_PUBLIC_`, never sent to the browser, never logged and never put in a URL. Five failed attempts from one IP within 15 minutes lock the form for the rest of that window (`RATE_LIMITED`). The page carries `noindex`.

**Department list.** One table of every department on the board, newest first:

| Column | Content |
| --- | --- |
| Select | Checkbox |
| Department | Label and slug |
| Source | Source URL as a link |
| Students / seats | Counts |
| Looks right | Count |
| Reports | Count; click to show each report's reason, note and time |
| Added | Date |

**Delete.** Tick one or more rows and press Delete selected. A confirm dialog lists the chosen departments with their source URLs and says that their students, seats, votes and reports will be removed. Delete in the dialog removes them all in one transaction, and fails any queued job for those URLs; Cancel changes nothing. It is a hard delete, and a deleted URL can be added again by anyone.

**Sign out** clears the cookie.

### Owner emails (Resend)

`packages/notify` defines the event union and one interface:

```ts
export type OwnerEvent =
  | { type: 'dataset.added'; slug: string; label: string; sourceUrl: string; students: number; seats: number; warnings: string[] }
  | { type: 'dataset.updated'; slug: string; label: string; sourceUrl: string; changed: true; seatsBefore: number; seatsAfter: number }
  | { type: 'dataset.reported'; slug: string; label: string; sourceUrl: string; reason: string; note?: string; reports: number; confirms: number }
  | { type: 'decoder.unknown'; slug: string; sourceUrl: string; logicHash: string };

export interface Notifier { send(event: OwnerEvent): Promise<void> }
export function createNotifier(env: NotifyEnv, log: Logger): Notifier; // Resend | Console
```

- Templates are pure functions `render(event) → { subject, text, html }` in `notify/templates`, one per event type, each with a link to `/admin` and to the source.
- `ResendNotifier` calls the Resend REST API with `fetch` (no SDK, keeps the scraper light) and an idempotency key of `type:slug:timestamp-minute`.
- Send at most 20 emails per hour. Beyond that, keep the events in memory and send one digest when the hour rolls over. Resend's free tier allows 100 emails a day.
- `send` never throws. Failures are logged at warn level and dropped.
- No email for Looks right votes, unchanged refreshes or failed jobs. Reports always send one.
- With no `RESEND_API_KEY`, the factory returns `ConsoleNotifier`.

## 8. API contract

Pages render on the server by calling services directly; the API exists for what the browser does after load: polling jobs, toggling confirmations, filing reports and admin actions. Every response uses the envelope from section 5, and every request body and query is parsed by a zod schema in `apps/web/src/server/schemas.ts` that is also exported as types for the client.

### Pages

| Path | Content |
| --- | --- |
| `/` | Roll input, department board, Add a department |
| `/r/[reg]` | Your papers across departments |
| `/d/[slug]` | Department page: source notice, counts, rooms, Refresh |
| `/d/[slug]/[room]/[slotKey]?me=[reg]` | Room view. `room` is the room name lowercased with spaces as dashes (`g-05`, `clash-room`); `slotKey` is `2026-11-03T14:30-15:50` |
| `/admin` | Owner page |

A registration number in the path is normalized (uppercase, `CIIT/` and `/ISB` stripped, dashes inserted, roll padded to 3 digits) and redirects to the canonical form when it differs.

### Public endpoints

| Method and path | Input | Returns | Errors |
| --- | --- | --- | --- |
| `GET /api/lookup?reg=` | registration number | `{ reg, name, departments: [{ dataset, papers: Paper[], tba: Course[] }] }`, papers sorted by date and time | `INVALID_REG_NUMBER`, `STUDENT_NOT_FOUND` |
| `GET /api/datasets` | none | `DatasetSummary[]`, newest first | none |
| `GET /api/datasets/[slug]/rooms/[room]/[slotKey]` | path | `{ dataset, room, slot, dims: { rows, cols }, courses: Course[], seats: RoomSeat[] }` | `DATASET_NOT_FOUND`, `ROOM_SLOT_NOT_FOUND` |
| `POST /api/jobs` | `{ url, kind?: 'add' \| 'refresh' }` | `{ job: JobView }` or `{ dataset: DatasetSummary }` when it is already on the board | `INVALID_SOURCE_URL`, `RATE_LIMITED`, `QUEUE_FULL`, `REFRESH_COOLDOWN` |
| `GET /api/jobs/[id]` | path | `JobView` | `JOB_NOT_FOUND` |
| `POST /api/scraper/wake` | none | `{ ok: true }` (fire-and-forget `/health` ping) | `RATE_LIMITED` |
| `POST /api/datasets/[slug]/confirm` | none | `{ confirmed: boolean, count: number }` | `DATASET_NOT_FOUND`, `RATE_LIMITED` |
| `POST /api/datasets/[slug]/reports` | `{ reason, note? }` | `{ reportId }` | `DATASET_NOT_FOUND`, `INVALID_INPUT`, `RATE_LIMITED` |
| `GET /api/github` | none | `{ stars: number \| null, url }`, cached 1 hour; `null` when GitHub is unreachable | none |

### Admin endpoints

All require the admin session cookie and fail with `UNAUTHORIZED` otherwise.

| Method and path | Input | Returns |
| --- | --- | --- |
| `POST /api/admin/session` | `{ token }` | sets the session cookie; `RATE_LIMITED` after 5 failures in 15 minutes |
| `DELETE /api/admin/session` | none | clears the cookie |
| `GET /api/admin/datasets` | none | every department with source URL and counts |
| `GET /api/admin/datasets/[slug]/reports` | none | that department's reports, newest first |
| `POST /api/admin/datasets/delete` | `{ slugs: string[] }`, 1 to 50 | `{ deleted: string[] }`, all in one transaction |

### Scraper endpoints (Render)

| Method and path | Auth | Effect |
| --- | --- | --- |
| `GET /health` | none | `200 ok`, starts a drain |
| `POST /kick` | `Authorization: Bearer SCRAPER_SECRET`, constant-time compare | `202`, starts a drain |

### Shared view types

```ts
interface DatasetSummary { slug: string; label: string; sourceUrl: string; stamp: string; students: number; seats: number;
                          confirms: number; reports: number; updatedAt: string; viewerConfirmed: boolean }
interface Paper { slotKey: string; date: string; start: string; end: string; course: Course; room: string;
                  roomSlug: string; position: SeatPosition; section: string | null }   // section only when not the home section
interface RoomSeat { position: SeatPosition; course: number; reg: string; name: string; section: string }
interface JobView { id: string; kind: 'add' | 'refresh'; status: 'queued' | 'running' | 'done' | 'failed';
                    stage: string; position: number | null; waking: boolean; datasetSlug: string | null;
                    error: PublicError | null; createdAt: string; elapsedSec: number }
```

`waking` is true while the job is queued and the scraper has not answered a kick in the last 15 seconds; the UI shows "Waking up scraper…" for it. The client polls `GET /api/jobs/[id]` every 2 seconds while the job is active and stops on `done` or `failed`.

Rate limits are stored in a small Postgres table (`rate_limits(key, window_start, count)`) with fixed one-hour windows, keyed by hashed IP or voter id. That avoids adding another service.

## 9. Design brief

youwho is a small, quiet tool with one interesting screen: the room. Everything before the room should take seconds and look plain; the room should be clear at a glance on a phone held in one hand.

### Principles

- **Plain first.** Printed seating chart, not dashboard. Thin rules, generous whitespace, colour only where it carries meaning.
- **One job per screen.** Home: type your number. Results: pick a paper. Room: see who is around you.
- **Data looks like data.** Roll numbers, course codes, seat labels and times are set in monospace.
- **No cute copy.** Short, literal labels. "Waking up scraper…", not jokes.
- **Fast on a phone.** Under 100 KB of JavaScript on the home page; the room view renders server-side and hydrates only the seat interactions.

### Type and themes

IBM Plex Sans for text and IBM Plex Mono for data, both via `next/font` with system fallbacks. Three themes, switched from the header and stored in a cookie so the server renders the right one with no flash:

| Theme | Background | Text | Accent (your seat) |
| --- | --- | --- | --- |
| Sand (default) | warm off-white | dark brown ink | amber |
| Day (light) | cool grey | navy ink | amber |
| Dusk (dark) | deep navy | off-white | amber |

All colours are CSS variables on `:root[data-theme=…]`; components never hard-code colours. Visitors without a theme cookie get Sand.

### Course colours

Generate a categorical palette of 10 hues in OKLCH. Each theme fixes lightness and chroma for fills and outlines, so the same course keeps its hue in every theme and stays legible. Assign colours per room view in order of seat count, largest course first. Your own course always gets the accent hue; other courses skip it. Above 10 courses in one room, reuse hues with a different texture.

Colour is never the only signal. Each course also gets a texture (solid, dots, diagonal lines, cross-hatch) drawn with small SVG patterns, and every seat's accessible label names its course.

### Screens

**Home.** Wordmark and theme switch at the top left; Star on GitHub button with the live count at the top right. Centre: a large roll-number field with placeholder `FA24-BSE-058` that formats as you type, and a Show button. Below it, **On the board**: one row per department with label, source host, "updated 31 Oct", student count, and a Looks right count. Under the list, a plain link: "Add your department". The last roll number used is remembered in `localStorage` and pre-filled.

**Add a department (sheet).** One URL field and an Add button. After submit, the sheet becomes a status card: a single line of state ("Waking up scraper…", "In line, 2 ahead of you", "Opening page", "Finding seating data", "Checking data", "Saving 13,916 seats"), an elapsed timer, and a thin progress rule with one tick per stage. On done: "Added" and a button to the department. On failure: the catalog message, the request id in small print, and Try again when the error is retryable. The user can close the sheet; a small toast tracks the job until it finishes.

**Your papers.** Name and registration number at the top. Then each department as a section: heading, the one-line source notice with Looks right and Report, and a list of papers sorted by date. Each paper row shows day and date, time, course code and title, room, and your seat. The whole row opens the room. Clash-room papers show "Clash Room, 2nd sitting". To-be-announced papers come last, marked TBA.

**Room view.**

1. Header: course you are sitting, room name, day, time, back link.
2. Source notice with Looks right and Report.
3. A bar across the top labelled FRONT.
4. The seat grid: rows top to bottom from the front, seats numbered from the invigilator's left (right to left on screen, see section 1), row numbers on the left edge and seat numbers along the top. Empty positions are faint outlines so gaps read correctly.
5. A strip at the back for extra chairs. In the Clash Room, a list of sittings replaces the grid.
6. Legend chips under the grid, one per course: colour swatch, code, count. Tapping a chip spotlights that course (others dim to 25%); tapping again clears it.

Your seat is filled with the accent colour, carries a small "you" tab above it, and has a soft pulsing ring (no pulse under `prefers-reduced-motion`). On load, the grid scrolls your seat into view. A Find button opens a roll-number box: a match (the full number, or its end when only one seat in the room matches) is outlined and scrolled into view with the name and seat shown under the box; no match says "Not in this room". Other seats use their course fill and texture. Tapping any seat opens a popover pinned to it (on phones too: it flips and shifts to stay on screen, and is never wider than the viewport) with name, registration number in mono, course code and title, section when it differs from the course's usual one, and seat label. Names never appear on the grid itself. When the viewer has a seat, seats of their own section carry a short tag (the section letter, for example `A` for `BSE-5A`) in both colour modes, with a key under the legend.

Sizing: seats are 28 px squares with 4 px gaps on desktop and shrink to a minimum of 22 px on a 360 px screen, which fits 12 seats per row. Wider rooms scroll horizontally inside their own container; pinch-zoom stays enabled.

**Department page.** Source notice, counts, update stamp, a list of rooms with how many slots use each, and a Refresh button showing the cooldown when active.

**Admin.** Utility styling: the sign-in field, the department list with checkboxes, and the confirm dialog from section 7. No theme work beyond reusing tokens.

### States

| State | Treatment |
| --- | --- |
| Loading | Skeleton rows on lists; grid outline at final size so nothing jumps |
| Empty board | "No departments yet" with the Add link |
| Roll not found | Catalog message under the field, field keeps focus |
| Any error | `<ErrorState>` from section 5, with Try again only when retryable |
| Offline | Browser offline event shows a thin bar "You're offline" |

### Accessibility

- The grid is a `role="grid"`; each seat is a button with a label like "Row 3, seat 5, CSC301 Design and Analysis of Algorithms, Ali Raza, FA23-BSE-001". Arrow keys move between seats; Enter opens details; Escape closes them.
- Text contrast meets WCAG AA in all three themes; seat fills meet 3:1 against the background.
- Every interactive target is at least 24 by 24 px, and 44 px for buttons outside the grid.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

### Star on GitHub

A bordered button with a star icon, "Star", and the count from `/api/github` in mono. It links to the repo. When the count is unavailable, show only "Star". It sits in the header on every page except admin.

## 10. Build phases

Build in ten phases, each ending in a working state you have checked by hand, and its own pull request. The order puts the read path in front of users before the scraper exists: a seed script loads the sample file, so the web app is usable from Phase 4.

1. **Phase 0 — Repository and tooling**
   - pnpm workspace with the layout from section 3; TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); ESLint with a `no-restricted-syntax` rule against `throw new Error` and `no-restricted-imports` rules for the package boundaries; Prettier.
   - `docker-compose.yml` with Postgres 16 for local development.
   - Check by hand: `pnpm lint` and `pnpm typecheck` pass; importing `packages/db` from a client component makes `pnpm lint` fail.
2. **Phase 1 — `errors` and `config`**
   - Catalog, `AppError`, `fail`, `isAppError`, `toAppError`, `toPublic`, envelope types; env schemas for web and scraper; shared pino logger with redaction.
   - Check by hand: starting an app with a variable missing prints a readable list and exits; `toPublic` on a wrapped unknown error shows `INTERNAL` and no cause.
3. **Phase 2 — `core`**
   - `RawPlanSchema`, decoder `v1` and the registry, URL canonicalizer, registration-number normalizer, slot keys, room slugs, `roomDims`, seat-position parser. Commit the sample as a fixture and add `pnpm check:decoder` (section 11).
   - Check by hand: `pnpm check:decoder` passes; editing one index in a copy of the fixture to point past its array fails with `DATA_DECODE_FAILED` and names the student.
4. **Phase 3 — `db`**
   - Drizzle schema and migrations for every table in section 4 plus `rate_limits` and `scraper_status`; client factory with two drivers (section 12); repositories; seed script `pnpm seed:fixture`.
   - Check by hand: the seed loads the fixture; running it again replaces rather than duplicates; deleting the dataset in `psql` removes its students, seats and feedback.
5. **Phase 4 — Web read path**
   - Composition root, `route()` wrapper, `apiFetch`, `<ErrorState>` and error copy; pages `/`, `/r/[reg]`, `/d/[slug]`, room view; seat grid with course colours, legend spotlight, seat details; source notice (actions stubbed).
   - Check by hand: look up a registration number typed in lowercase without dashes, open a room at 360 px, find your seat in view, tap a neighbour, move through seats with the arrow keys.
6. **Phase 5 — Scraper service**
   - `PageSource` interface, fixture and Playwright implementations; pipeline steps; runner with claim, deadline, heartbeat, hard exit and boot sweep; `/health` and `/kick`; Dockerfile; build.
   - Check by hand: a fixture-mode job reaches done; with `JOB_LIMIT_MS=5000` and a slow fixture the job fails with `SCRAPE_TIMEOUT` and the next queued job still runs; killing the process mid-job and restarting marks that job `SCRAPER_RESTARTED`; after deploying to Render, one real scrape of the CS page succeeds.
7. **Phase 6 — Add and refresh flow**
   - `POST /api/jobs`, `GET /api/jobs/[id]` with queue position, waking flag and web-side sweeps; `/api/scraper/wake`; the Add sheet and status card; Refresh with cooldown; rate limits.
   - Check by hand: add a department and watch every stage; submit the same URL from two tabs and see one job; a second refresh within 10 minutes shows the cooldown message.
8. **Phase 7 — Confirmations and reports**
   - Voter cookie, confirm toggle, report sheet, counters updated in transactions, limits.
   - Check by hand: toggle Looks right from two browsers and the count stays correct; a report appears in the console notifier output.
9. **Phase 8 — Admin and notifications**
   - Admin sign-in, department list, select and delete with a confirm dialog; `packages/notify` with Resend and console notifiers, templates, hourly cap and digest; wire events from web and scraper.
   - Check by hand: deleting a dataset removes it from the board and from lookups and fails its queued job; each owner event type sends one real email through Resend.
10. **Phase 9 — Polish and launch**
    - Three themes without flash, Star button, reduced motion, empty and offline states, metadata and favicon, README with setup and deploy steps.
    - Check by hand: Lighthouse on the home page scores at least 95 for performance and accessibility on mobile; switching themes never flashes; production is deployed on Vercel and Render.

## 11. Verification

There is no automated test suite and no CI pipeline. Two cheap checks stay because they catch the failures that would silently show students the wrong seats or break a deploy; everything else is checked by hand against the fixture at the end of each phase.

### Kept on purpose

| Check | What it does | Why it is worth keeping |
| --- | --- | --- |
| `pnpm check:decoder` | A plain script (no test framework) in `scripts/check-decoder.ts`. It decodes the fixture and exits non-zero unless it gets 2,533 students with seats, 13,916 seats and one TBA-only student, and unless four hand-picked records match: an ordinary seat, a section override, a Clash Room sitting and an extra chair. | The decoder is the one place a bug puts students in the wrong seats without any visible error. Run it after any change to `packages/core`. |
| Type check on build | `next build` already type-checks the web app; the scraper's `build` script runs `tsc --noEmit` before `tsup`. | A typo in an error code, a broken import or a renamed field stops the deploy instead of reaching users. Costs nothing extra. |

### Deployment without CI

- Vercel builds the web app on every push to `main` and gives each branch a preview URL. Render auto-deploys the scraper from `main` using its Dockerfile.
- A failed build keeps the previous deploy live on both, so a bad push never takes the site down.
- Run `pnpm db:migrate` by hand against Neon before merging a schema change. Migrations are additive where possible, so the old code keeps working until the new deploy lands.

### Manual checks

Each phase in section 10 ends with a short Check by hand list. Do it with the seeded fixture and the scraper in fixture mode. For any phase that touches the UI, also look at the room view on a 360 px viewport and on desktop, in Paper and Chalkboard, and trigger one error path (for example a bad registration number) to confirm the catalog message shows.

For scraper work, `apps/scraper/dev/iframe-fixture` holds a tiny local site with three nested iframes on two ports and a `script#data` in the innermost one. Point the Playwright source at it (with `localhost` allowed) to develop frame-walking without hitting Google. It is a development aid, not a test.

## 12. Conventions and CLAUDE.md

Put this spec in the repo as `docs/spec.md` and the file below at the root as `CLAUDE.md`. Claude Code reads `CLAUDE.md` on every session; it points back to the spec for detail.

### Decisions not stated elsewhere

- **Database drivers.** `packages/db` exports `createDb({ url, driver })`. The web app uses `@neondatabase/serverless` (WebSocket `Pool`, which supports transactions) with Drizzle's `neon-serverless` adapter. The scraper uses `postgres` (postgres.js) with Drizzle's `postgres-js` adapter, at most 2 connections. Repositories are written once against Drizzle and work with both.
- **Scraper liveness.** The scraper writes `now()` to a one-row table `scraper_status(last_seen_at)` whenever it handles `/health` or `/kick` and on each drain. The web app's `waking` flag is true while a job is queued and `last_seen_at` is older than 30 seconds.
- **Configurable page source.** `PlaywrightPageSource` takes `allowedHosts` and `expectedHost` in its constructor. Production passes the Google hosts; the local iframe fixture passes `localhost`.
- **Configurable job limit.** `JOB_LIMIT_MS` defaults to 180000 (3 minutes); lower it locally to check the timeout path by hand.
- **Versions.** Pin exact versions in `package.json` and commit the lockfile. Use releases at least two weeks old.

### CLAUDE.md

```markdown
# youwho

Shows students who sits around them in an exam room, from department seating plans
published on Google Sites. Full spec: docs/spec.md (section numbers below refer to it).

## Stack
- pnpm workspaces, TypeScript strict, Node 22
- apps/web: Next.js App Router on Vercel, Tailwind, Radix primitives, next-themes
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
```

### Code style

- Named exports only; one concept per file; files under 300 lines.
- Functions take an options object once they need more than two parameters.
- Domain types live in `core/types.ts`; view types in `apps/web/src/server/schemas.ts`. Never pass Drizzle rows to React.
- Prefer `async`/`await` with explicit `AbortSignal` parameters for anything that can take longer than a second.
- Dates are ISO strings across boundaries; formatting for display happens only in the UI layer, in `Asia/Karachi` time.

## 13. Implementation notes (changes from this spec)

Recorded while building; the behaviour below is what is implemented.

- `seats` has an extra `end_time` column and `room` stores the room name, not an index. The slot key includes the end time (`2026-11-03T08:30-09:50`), because papers that start together but end at different times (80 and 90 minutes) are different sessions; a room view shows only its own slot. Section 4's `SlotKey` example and section 8's `slotKey` path are updated to match.
- `DATA_REVISION` in `packages/core` is mixed into `data_hash`; bump it when decoded output changes shape so existing datasets re-save on their next refresh.
- New optional env variable `SITE_URL` (links in owner emails). Scraper-only dev variables: `FIXTURE_DIR`, `FIXTURE_DELAY_MS`, `DEV_ALLOW_LOCALHOST`.
- Themes use a plain cookie and CSS variables instead of `next-themes`. After a design review the themes are **Day** (default: navy masthead, cool grey canvas, white cards, blue for actions), **Dusk** (deep navy dark theme, the default under a dark system setting) and **Sand** (warm light). Old cookie values map to the nearest one. Type is Inter for text and IBM Plex Mono for data.
- UI redesign: seats are drawn as chairs seen from above (cushion, armrests, backrest at the back edge), sized to fit the card (20–44 px, with zoom from 75% to 185% and a "Find me" button); the front board spans exactly the seat block; the room view has a "Your seat" card and a legend that lists course names (not only codes) and can colour seats by course or by section. Seat details show where that person sits relative to you. Amber is reserved for "you"; courses, sections and exam days take hues from one OKLCH palette with shared lightness and chroma per theme, assigned largest group first so the biggest groups get the most distinct colours. Papers are grouped by day under coloured date tiles; every paper is a card with a "View room map" affordance. Navigation uses a back button plus breadcrumb. The home heading reads "HEck or HAck?".
- `@youwho/db` exposes the drivers as subpaths (`/client`, `/postgres`, `/neon`) so the scraper never loads the Neon driver.
- `AppError` carries a brand checked by `isAppError`, because bundlers can load the errors package twice and break `instanceof`.
- Server components do not throw `AppError`; `loadPage()` returns the public error so the catalog copy survives production builds.
- Job `stage` values are `opening`, `extracting`, `checking` and `saving:<seats>`.
- Owner emails are sent from `youwho <youwho@umernisar.dev>` (verified Resend domain) to the owner address.
- `PlaywrightPageSource` gives up with `SOURCE_NO_DATA` after 45 seconds of not finding the data.
- Seat details use one Radix dialog (bottom sheet on phones, centred card on desktop) instead of a separate popover.
- Course textures are CSS gradients rather than SVG patterns.
- The home page ships about 146 KB of gzipped JavaScript, of which about 118 KB is the Next.js and React baseline, so the 100 KB target in section 9 is not reachable with this stack. The add sheet is loaded on demand. Lighthouse (mobile) scores 100 for performance, accessibility, best practices and SEO.
- The scraper is deployed on Heroku (container stack, `heroku.yml`, Eco dyno, about $5/month) instead of Render's free tier, so the "hosting must stay free" decision no longer holds for the scraper. The Dockerfile is unchanged; `render.yaml` was removed.
