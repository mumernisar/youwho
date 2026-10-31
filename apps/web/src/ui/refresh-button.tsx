'use client';

import { useTracker } from './add-department';

/** `waitMin` is the cooldown left when the page was rendered; 0 means refreshing is allowed. */
export function RefreshButton({ url, waitMin }: { url: string; waitMin: number }) {
  const { refresh } = useTracker();
  return (
    <div className="flex items-center gap-3">
      <button type="button" disabled={waitMin > 0} onClick={() => refresh(url)} className="min-h-11 rounded border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-bg disabled:border-rule disabled:text-muted disabled:hover:bg-transparent">
        Refresh
      </button>
      {waitMin > 0 && <span className="text-sm text-muted">Updated a few minutes ago. Available in about {waitMin} min.</span>}
    </div>
  );
}
