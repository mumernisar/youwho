import { z } from 'zod';

const secret = z.string().min(32, 'must be at least 32 characters');
const optionalString = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());

const notifyShape = {
  /** Public base URL of the web app; used for links in owner emails. */
  SITE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  RESEND_API_KEY: optionalString,
  OWNER_EMAIL: optionalString,
  NOTIFY_FROM: optionalString,
};

/** With a Resend key set, the owner address and sender must be present too. */
const requireNotifyPair = (
  v: { SITE_URL?: string | undefined; RESEND_API_KEY?: string | undefined; OWNER_EMAIL?: string | undefined; NOTIFY_FROM?: string | undefined },
  ctx: z.RefinementCtx,
) => {
  if (!v.RESEND_API_KEY) return;
  for (const key of ['OWNER_EMAIL', 'NOTIFY_FROM'] as const) {
    if (!v[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required when RESEND_API_KEY is set' });
  }
};

export const webEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    SCRAPER_URL: z.url(),
    SCRAPER_SECRET: secret,
    ADMIN_TOKEN: z.string().min(16, 'must be at least 16 characters'),
    SESSION_SECRET: secret,
    HASH_SALT: secret,
    GITHUB_REPO: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'must look like owner/name'),
    GITHUB_TOKEN: optionalString,
    ...notifyShape,
  })
  .superRefine(requireNotifyPair);

export const scraperEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    SCRAPER_SECRET: secret,
    PAGE_SOURCE: z.enum(['playwright', 'fixture']).default('playwright'),
    JOB_LIMIT_MS: z.coerce.number().int().positive().default(180_000),
    PORT: z.coerce.number().int().positive().default(8080),
    /** Fixture mode: where the sample files live, and an artificial delay to exercise the timeout path. */
    FIXTURE_DIR: optionalString,
    FIXTURE_DELAY_MS: z.coerce.number().int().nonnegative().default(0),
    /** Development only: let the Playwright source visit localhost (the nested-iframe fixture site). */
    DEV_ALLOW_LOCALHOST: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    ...notifyShape,
  })
  .superRefine(requireNotifyPair);

export type WebEnv = z.infer<typeof webEnvSchema>;
export type ScraperEnv = z.infer<typeof scraperEnvSchema>;

type Source = Record<string, string | undefined>;

/** Parse once at startup. On problems, print every one and exit, so nothing runs half-configured. */
function load<T>(name: string, schema: z.ZodType<T>, source: Source): T {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
  console.error(`Invalid ${name} environment:\n${lines.join('\n')}`);
  process.exit(1);
}

export const loadWebEnv = (source: Source = process.env): WebEnv => load('web', webEnvSchema, source);
export const loadScraperEnv = (source: Source = process.env): ScraperEnv =>
  load('scraper', scraperEnvSchema, source);
