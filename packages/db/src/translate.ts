import { fail, isAppError } from '@youwho/errors';

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EPIPE',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  '57P01',
  '57P03',
  '53300',
]);

/** Walk the cause chain looking for a Postgres or network error code. */
export function dbErrorCode(e: unknown): string | undefined {
  for (let cur: unknown = e, depth = 0; cur && depth < 5; depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export const isUniqueViolation = (e: unknown): boolean => dbErrorCode(e) === '23505';

/** Boundary for every repo call: connection problems become DB_UNAVAILABLE, the rest passes through. */
export async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (isAppError(e)) throw e;
    const code = dbErrorCode(e);
    if ((code && (CONNECTION_CODES.has(code) || code.startsWith('08'))) || /fetch failed|timeout/i.test(String((e as Error)?.message))) {
      return fail('DB_UNAVAILABLE', { cause: e });
    }
    throw e;
  }
}
