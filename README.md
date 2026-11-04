# youwho

See who is sitting around you in the exam room. youwho reads department seating plans published on Google Sites and draws the room: every seat, coloured by course, your seat marked, a tap on any seat for the name and roll number.

The build spec is in [`docs/spec.md`](docs/spec.md); build progress is in [`docs/progress.md`](docs/progress.md).

```
apps/web        Next.js (Vercel): pages, API, admin
apps/scraper    Node 22 + Playwright (Heroku, Docker): add and refresh jobs
packages/       errors, core, db, notify, config
```

## Run it locally

Needs Node 22, pnpm (`corepack enable`) and Docker.

```sh
pnpm install
cp .env.example .env          # then fill it in (see below)
ln -s ../../.env apps/web/.env
docker compose up -d          # Postgres 16 on localhost:5433
pnpm db:migrate
pnpm seed:fixture             # loads the sample CS mid-term plan
pnpm dev                      # web on :3000, scraper on :8080 (PAGE_SOURCE=fixture)
```

Open <http://localhost:3000> and look up `FA21-BAI-019`.

Other commands: `pnpm lint`, `pnpm typecheck`, `pnpm check:decoder` (run after any change to `packages/core`), `pnpm db:generate` (after a schema change).

### Environment

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | web, scraper | Local: `postgresql://youwho:youwho@localhost:5433/youwho`. Production: the Neon URL |
| `NEON_DATABASE_URL` | scripts | Only for `pnpm db:migrate --neon` and `pnpm seed:fixture --neon` |
| `SCRAPER_URL`, `SCRAPER_SECRET` | web (both: secret) | Base URL of the scraper and the shared bearer secret (32+ characters). Local: `http://localhost:8080`. The scraper must use the same database as the web app, so a local web app pointed at the Heroku scraper leaves jobs waiting until they fail |
| `ADMIN_TOKEN` | web | Password for `/admin` |
| `SESSION_SECRET`, `HASH_SALT` | web | 32+ random characters each. Changing `HASH_SALT` resets everyone's votes |
| `GITHUB_REPO`, `GITHUB_TOKEN` | web | `owner/name` for the Star button; token is optional |
| `SITE_URL` | web, scraper | Public URL of the web app, used in email links |
| `RESEND_API_KEY`, `OWNER_EMAIL`, `NOTIFY_FROM` | web, scraper | Without a key, owner events go to the log |
| `ANALYTICS_ENABLED` | web | `true` turns on Vercel Web Analytics. Set it for Production only, so previews and local runs send nothing |
| `PAGE_SOURCE`, `JOB_LIMIT_MS` | scraper | `fixture` or `playwright`; job limit defaults to 180000 |

Generate secrets with `openssl rand -hex 32`.

## Deploy

Web, database and email run on free tiers; the scraper dyno is the one paid piece. There is no CI: each platform builds from `main`, and a failed build keeps the previous deploy live.

1. **Database (Neon).** Create a project and copy the pooled connection string. Run `pnpm db:migrate --neon` from your machine before merging any schema change.
2. **Scraper (Heroku).** Heroku has no free tier; an Eco dyno ($5/month, 512 MB) is enough. The app uses the container stack and the root `Dockerfile` through `heroku.yml`:
   ```sh
   heroku create youwho-scraper --stack container
   heroku ps:type eco -a youwho-scraper
   heroku config:set -a youwho-scraper \
     DATABASE_URL=... SCRAPER_SECRET=... RESEND_API_KEY=... \
     OWNER_EMAIL=... NOTIFY_FROM='youwho <youwho@umernisar.dev>' SITE_URL=... \
     PAGE_SOURCE=playwright JOB_LIMIT_MS=180000
   git push heroku main          # or connect the GitHub repo and enable automatic deploys
   ```
   Do not set `PORT`; Heroku injects it. There is no health-check setting: the web app wakes the dyno through `/health`. The URL (`https://youwho-scraper-….herokuapp.com`) is the web app's `SCRAPER_URL`.
3. **Web (Vercel).** Import the repo with root directory `apps/web` and "Include source files outside of the Root Directory" enabled. Set every web variable above; `SCRAPER_URL` is the Heroku app URL.
4. **Email (Resend).** Without a verified domain, Resend only delivers to the account owner's address, so `OWNER_EMAIL` must be that address and `NOTIFY_FROM` must be `youwho <onboarding@resend.dev>`. With a verified domain (this project uses `umernisar.dev`) use `youwho <youwho@umernisar.dev>` and any recipient.
5. **Check it.** Add a department from the live site and watch it reach "Added"; look up a roll number; sign in at `/admin`.

An Eco dyno sleeps after 30 minutes without traffic and Heroku restarts dynos about once a day (a job running at that moment fails with `SCRAPER_RESTARTED` and can be retried). The first job after a sleep shows "Waking up scraper…" for up to a minute.

## Adding a new page format

If a department's page uses a different decoder script, the scraper still decodes it with the latest decoder, marks the dataset `decoderKnown: false`, and emails you. Add a `v2` decoder beside `v1` in `packages/core/src/decoders` and register its script hash. Never edit `v1`.
