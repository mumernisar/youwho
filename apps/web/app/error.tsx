'use client';

import { ErrorState } from '@/ui/error-state';

/** Last resort for crashes while rendering. Expected failures are handled by loadPage. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={{ code: 'INTERNAL', message: 'Something went wrong on our side.', retryable: true, ...(error.digest ? { requestId: error.digest } : {}) }}
      onRetry={reset}
    />
  );
}
