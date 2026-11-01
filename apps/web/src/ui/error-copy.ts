import type { ErrorCode } from '@youwho/errors';

export type ErrorIcon = 'alert' | 'search' | 'lock' | 'clock' | 'offline';
export type ErrorAction = 'retry' | 'edit-input' | 'go-home' | 'add-department' | 'none';

export interface ErrorPresentation {
  icon: ErrorIcon;
  heading: string;
  action: ErrorAction;
}

/** Typed over every catalog code, so a new code fails the type check until it has copy. */
export const ERROR_COPY: Record<ErrorCode | 'NETWORK_ERROR', ErrorPresentation> = {
  INVALID_INPUT: { icon: 'alert', heading: 'Check your input', action: 'edit-input' },
  INVALID_REG_NUMBER: { icon: 'alert', heading: 'Not a registration number', action: 'edit-input' },
  INVALID_SOURCE_URL: { icon: 'alert', heading: 'Not a Google Sites link', action: 'edit-input' },
  STUDENT_NOT_FOUND: { icon: 'search', heading: 'No seats found', action: 'edit-input' },
  DATASET_NOT_FOUND: { icon: 'search', heading: 'Department not found', action: 'go-home' },
  ROOM_SLOT_NOT_FOUND: { icon: 'search', heading: 'Empty room', action: 'go-home' },
  JOB_NOT_FOUND: { icon: 'search', heading: 'Request not found', action: 'add-department' },
  RATE_LIMITED: { icon: 'clock', heading: 'Slow down', action: 'retry' },
  QUEUE_FULL: { icon: 'clock', heading: 'Queue is full', action: 'retry' },
  REFRESH_COOLDOWN: { icon: 'clock', heading: 'Updated recently', action: 'none' },
  UNAUTHORIZED: { icon: 'lock', heading: 'Not signed in', action: 'go-home' },
  SOURCE_UNREACHABLE: { icon: 'alert', heading: 'Page could not be opened', action: 'retry' },
  SOURCE_NOT_PUBLIC: { icon: 'lock', heading: 'Page is not public', action: 'edit-input' },
  SOURCE_NO_DATA: { icon: 'search', heading: 'No seating plan found', action: 'edit-input' },
  SOURCE_TOO_LARGE: { icon: 'alert', heading: 'Data is too large', action: 'none' },
  SCRAPE_TIMEOUT: { icon: 'clock', heading: 'Took too long', action: 'retry' },
  DATA_INVALID_JSON: { icon: 'alert', heading: 'Data is not readable', action: 'none' },
  DATA_SHAPE_INVALID: { icon: 'alert', heading: 'Unexpected format', action: 'none' },
  DATA_DECODE_FAILED: { icon: 'alert', heading: 'Could not decode data', action: 'none' },
  SCRAPER_RESTARTED: { icon: 'alert', heading: 'Scraper restarted', action: 'retry' },
  SCRAPER_STALLED: { icon: 'alert', heading: 'Scraper stopped', action: 'retry' },
  SCRAPER_UNAVAILABLE: { icon: 'alert', heading: 'Scraper unavailable', action: 'retry' },
  DB_UNAVAILABLE: { icon: 'alert', heading: 'Temporary problem', action: 'retry' },
  SITE_DECOMMISSIONED: { icon: 'lock', heading: 'Site taken down', action: 'none' },
  INTERNAL: { icon: 'alert', heading: 'Something went wrong', action: 'retry' },
  NETWORK_ERROR: { icon: 'offline', heading: 'No connection', action: 'retry' },
};
