import 'server-only';
import { notFound } from 'next/navigation';
import { toAppError, type PublicError } from '@youwho/errors';
import { logAppError } from './log-error';
import { getServices } from './services';

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: PublicError };

/**
 * Run a service call from a server component. Missing datasets and rooms become Next's 404.
 * Every other failure comes back as a public error for <ErrorState>, so a raw stack never reaches
 * the page and the catalog copy survives production builds (which hide thrown messages).
 */
export async function loadPage<T>(run: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (e) {
    const err = toAppError(e);
    if (err.def.category === 'not_found' && err.code !== 'STUDENT_NOT_FOUND') notFound();
    const requestId = crypto.randomUUID();
    logAppError(getServices(), err, { requestId, page: true });
    return { ok: false, error: err.toPublic(requestId) };
  }
}
