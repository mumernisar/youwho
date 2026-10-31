import type { ErrorCode } from './catalog';

export interface PublicError {
  code: ErrorCode | 'NETWORK_ERROR';
  message: string;
  retryable: boolean;
  details?: unknown;
  requestId?: string;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: PublicError };
