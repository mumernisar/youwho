import { ERRORS, type DetailsOf, type ErrorCode } from './catalog';
import type { PublicError } from './envelope';

/**
 * Bundlers can load this module twice (server components and route handlers get separate copies),
 * which breaks `instanceof`. Every AppError carries this brand so checks work across copies.
 */
const BRAND = Symbol.for('youwho.AppError');

export class AppError<C extends ErrorCode = ErrorCode> extends Error {
  readonly [BRAND] = true;
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

  /** Safe for clients: never includes cause or stack. Hidden errors collapse to INTERNAL. */
  toPublic(requestId?: string): PublicError {
    const out: PublicError = this.def.expose
      ? { code: this.code, message: this.message, retryable: this.def.retryable }
      : { code: 'INTERNAL', message: ERRORS.INTERNAL.message, retryable: ERRORS.INTERNAL.retryable };
    if (this.def.expose && this.details !== undefined) out.details = this.details;
    if (requestId !== undefined) out.requestId = requestId;
    return out;
  }
}

export const fail = <C extends ErrorCode>(
  code: C,
  ...args: undefined extends DetailsOf<C>
    ? [opts?: { details?: DetailsOf<C>; message?: string; cause?: unknown }]
    : [opts: { details: DetailsOf<C>; message?: string; cause?: unknown }]
): never => {
  throw new AppError(code, args[0] ?? {});
};

export const isAppError = (e: unknown, code?: ErrorCode): e is AppError =>
  typeof e === 'object' && e !== null && (e as Record<symbol, unknown>)[BRAND] === true &&
  (code === undefined || (e as AppError).code === code);

export const toAppError = (e: unknown): AppError =>
  isAppError(e) ? e : new AppError('INTERNAL', { cause: e });
