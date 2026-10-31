export type ErrorCategory =
  | 'input'
  | 'not_found'
  | 'limit'
  | 'auth'
  | 'source'
  | 'data'
  | 'unavailable'
  | 'internal';

export interface ErrorDef {
  status: number;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  expose: boolean;
  log: 'info' | 'warn' | 'error';
}

export const ERRORS = {
  INVALID_INPUT: { status: 400, category: 'input', message: 'Some of that input is not valid.', retryable: false, expose: true, log: 'info' },
  INVALID_REG_NUMBER: { status: 400, category: 'input', message: 'That is not a registration number. Type it like FA24-BSE-058.', retryable: false, expose: true, log: 'info' },
  INVALID_SOURCE_URL: { status: 400, category: 'input', message: 'Paste the link of a public Google Sites page.', retryable: false, expose: true, log: 'info' },
  STUDENT_NOT_FOUND: { status: 404, category: 'not_found', message: 'No seats found for that registration number.', retryable: false, expose: true, log: 'info' },
  DATASET_NOT_FOUND: { status: 404, category: 'not_found', message: 'That department is not on the board.', retryable: false, expose: true, log: 'info' },
  ROOM_SLOT_NOT_FOUND: { status: 404, category: 'not_found', message: 'Nobody is seated in that room at that time.', retryable: false, expose: true, log: 'info' },
  JOB_NOT_FOUND: { status: 404, category: 'not_found', message: 'That request no longer exists.', retryable: false, expose: true, log: 'info' },
  RATE_LIMITED: { status: 429, category: 'limit', message: 'Too many requests. Wait a little and try again.', retryable: true, expose: true, log: 'info' },
  QUEUE_FULL: { status: 503, category: 'limit', message: 'The scraper queue is full. Try again in a few minutes.', retryable: true, expose: true, log: 'warn' },
  REFRESH_COOLDOWN: { status: 429, category: 'limit', message: 'This department was updated a few minutes ago.', retryable: true, expose: true, log: 'info' },
  UNAUTHORIZED: { status: 401, category: 'auth', message: 'You are not signed in.', retryable: false, expose: true, log: 'warn' },
  SOURCE_UNREACHABLE: { status: 502, category: 'source', message: 'That page could not be opened.', retryable: true, expose: true, log: 'warn' },
  SOURCE_NOT_PUBLIC: { status: 422, category: 'source', message: 'That page is not public. It asks for a sign-in.', retryable: false, expose: true, log: 'info' },
  SOURCE_NO_DATA: { status: 422, category: 'source', message: 'No seating plan was found on that page.', retryable: false, expose: true, log: 'info' },
  SOURCE_TOO_LARGE: { status: 422, category: 'source', message: 'The seating data on that page is too large.', retryable: false, expose: true, log: 'warn' },
  SCRAPE_TIMEOUT: { status: 504, category: 'source', message: 'Reading that page took longer than 3 minutes.', retryable: true, expose: true, log: 'warn' },
  DATA_INVALID_JSON: { status: 422, category: 'data', message: 'The seating data on that page is not readable.', retryable: false, expose: true, log: 'warn' },
  DATA_SHAPE_INVALID: { status: 422, category: 'data', message: 'The seating data is not in the expected format.', retryable: false, expose: true, log: 'warn' },
  DATA_DECODE_FAILED: { status: 422, category: 'data', message: 'The seating data could not be decoded.', retryable: false, expose: true, log: 'warn' },
  SCRAPER_RESTARTED: { status: 503, category: 'unavailable', message: 'The scraper restarted during this job. Please try again.', retryable: true, expose: true, log: 'warn' },
  SCRAPER_STALLED: { status: 503, category: 'unavailable', message: 'The scraper stopped responding. Please try again.', retryable: true, expose: true, log: 'error' },
  SCRAPER_UNAVAILABLE: { status: 503, category: 'unavailable', message: 'The scraper could not be reached. Please try again later.', retryable: true, expose: true, log: 'error' },
  DB_UNAVAILABLE: { status: 503, category: 'unavailable', message: 'youwho is having trouble right now. Please try again.', retryable: true, expose: true, log: 'error' },
  INTERNAL: { status: 500, category: 'internal', message: 'Something went wrong on our side.', retryable: true, expose: true, log: 'error' },
} as const satisfies Record<string, ErrorDef>;

export type ErrorCode = keyof typeof ERRORS;

export interface ErrorDetails {
  INVALID_INPUT: { issues: { path: string; message: string }[] };
  DATA_SHAPE_INVALID: { issues: { path: string; message: string }[] };
  DATA_DECODE_FAILED: { reg?: string; offset?: number; reason: string };
  RATE_LIMITED: { retryAfterSec: number };
  REFRESH_COOLDOWN: { retryAfterSec: number };
  DATASET_NOT_FOUND: { slug: string };
  SOURCE_UNREACHABLE: { httpStatus?: number } | undefined;
}

export type DetailsOf<C extends ErrorCode> = C extends keyof ErrorDetails ? ErrorDetails[C] : undefined;
