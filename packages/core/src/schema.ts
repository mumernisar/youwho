import { z } from 'zod';
import { fail } from '@youwho/errors';

export const MAX_RAW_BYTES = 5 * 1024 * 1024;

const text = z.string().max(300);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'not a real date');
const time = z.string().regex(/^\d{2}:\d{2}$/);
const course = z.tuple([text, text, text]);

export const RawPlanSchema = z.object({
  stamp: text,
  slots: z.array(z.tuple([date, time, time])),
  kinds: z.array(z.union([z.tuple([text, text, text]), z.tuple([text, text])])),
  cls: z.array(text),
  rooms: z.array(text),
  special: z.array(text),
  groups: z.record(text, z.string()),
  classes: z.unknown().optional(),
  tba: z.record(text, z.array(course)).optional(),
  totals: z.object({ students: z.number().int().nonnegative(), seats: z.number().int().nonnegative() }),
});

export type RawPlan = z.infer<typeof RawPlanSchema>;

const ROW_RE = /^\d+\|[^|]{0,300}\|[0-9a-z]{2}\|[0-9a-z~.]*$/;

/** Parse the page's data text: size, JSON, shape, and group-row format. Shape and type only. */
export function parseRawPlan(raw: string): RawPlan {
  if (raw.length > MAX_RAW_BYTES) fail('SOURCE_TOO_LARGE');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    return fail('DATA_INVALID_JSON', { cause });
  }
  const result = RawPlanSchema.safeParse(json);
  if (!result.success) {
    return fail('DATA_SHAPE_INVALID', {
      details: {
        issues: result.error.issues.slice(0, 20).map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      cause: result.error,
    });
  }
  const plan = result.data;
  for (const [prefix, str] of Object.entries(plan.groups)) {
    const rows = str === '' ? [] : str.split(';');
    for (const [n, row] of rows.entries()) {
      if (!ROW_RE.test(row)) {
        fail('DATA_SHAPE_INVALID', {
          details: { issues: [{ path: `groups.${prefix}[${n}]`, message: 'row is not roll|name|homeClass|seatCode' }] },
        });
      }
    }
  }
  return plan;
}
