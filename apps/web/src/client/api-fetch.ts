import type { ApiResponse, ErrorCode } from '@youwho/errors';

/** Rebuilt from the response envelope. Components read `code`, never `response.status`. */
export class ClientError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly retryable: boolean;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(e: { code: ErrorCode | 'NETWORK_ERROR'; message: string; retryable: boolean; details?: unknown; requestId?: string }) {
    super(e.message);
    this.name = 'ClientError';
    this.code = e.code;
    this.retryable = e.retryable;
    this.details = e.details;
    this.requestId = e.requestId;
  }
}

/** The only way the browser calls the API. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let body: ApiResponse<T>;
  try {
    const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ClientError({ code: 'NETWORK_ERROR', message: 'Could not reach youwho. Check your connection.', retryable: true });
  }
  if (body.ok) return body.data;
  throw new ClientError(body.error);
}
