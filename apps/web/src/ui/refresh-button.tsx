'use client';

import { useTracker } from './add-department';
import { Refresh } from './icons';

/** `waitMin` is the cooldown left when the page was rendered; 0 means refreshing is allowed. */
export function RefreshButton({ url, waitMin }: { url: string; waitMin: number }) {
  const { refresh } = useTracker();
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" disabled={waitMin > 0} onClick={() => refresh(url)} className="btn btn-secondary">
        <Refresh className="h-4 w-4" />
        Refresh from source
      </button>
      {waitMin > 0 && <span className="text-xs text-muted">Updated a few minutes ago. Available in about {waitMin} min.</span>}
    </div>
  );
}
