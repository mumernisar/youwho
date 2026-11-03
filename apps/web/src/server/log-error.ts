import 'server-only';
import type { AppError } from '@youwho/errors';
import type { Logger } from '@youwho/config';

export function logAppError(s: { log: Logger } | undefined, err: AppError, fields: Record<string, unknown>): void {
  const line = { ...fields, code: err.code, ...(err.def.log === 'error' ? { err: err.cause ?? err } : {}) };
  const log = s?.log;
  if (!log) return console.error(JSON.stringify({ level: 'error', msg: err.message, ...fields, code: err.code }));
  log[err.def.log](line, err.message);
}
