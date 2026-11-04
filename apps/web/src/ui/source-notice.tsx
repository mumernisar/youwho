import type { DatasetSummary } from '@/server/schemas';
import { SourceActions } from './source-actions';
import { sourceHost } from './format';
import { External, Shield } from './icons';

export function SourceLink({ url, className = '' }: { url: string; className?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={`link inline-flex max-w-full items-center gap-1 font-mono text-[0.8125rem] ${className}`}>
      <span className="truncate">{sourceHost(url)}</span>
      <External className="h-3.5 w-3.5 flex-none" />
    </a>
  );
}

/** Full notice for the department page and room view; `compact` is the one-liner for roll results.
 *  `actions` is false on a copy saved on the phone, where Looks right and Report cannot reach the server. */
export function SourceNotice({ dataset, compact, actions = true }: { dataset: DatasetSummary; compact?: boolean; actions?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
          <Shield className="h-4 w-4 flex-none text-brand" />
          <span className="flex-none">Added by a user · Source</span>
          <SourceLink url={dataset.sourceUrl} className="min-w-0" />
        </p>
        {actions && <SourceActions slug={dataset.slug} confirms={dataset.confirms} confirmed={dataset.viewerConfirmed} />}
      </div>
    );
  }
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-2 p-4 sm:flex-row sm:items-center sm:p-5">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-soft text-brand"><Shield className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-ink-2">This department&apos;s data was added by a user. Report it if you believe it came from the wrong source.</p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-muted">Source of data: <SourceLink url={dataset.sourceUrl} className="min-w-0" /></p>
      </div>
      <SourceActions slug={dataset.slug} confirms={dataset.confirms} confirmed={dataset.viewerConfirmed} />
    </aside>
  );
}
