import type { DatasetSummary } from '@/server/schemas';
import { SourceActions } from './source-actions';
import { sourceHost } from './format';

export function SourceLink({ url, className = '' }: { url: string; className?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={`break-all font-mono underline decoration-rule underline-offset-2 hover:decoration-ink ${className}`}>
      {sourceHost(url)}
    </a>
  );
}

/** Full notice for the department page and room view; `compact` is the one-liner for roll results. */
export function SourceNotice({ dataset, compact }: { dataset: DatasetSummary; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted">
        <span>Source of data: <SourceLink url={dataset.sourceUrl} /></span>
        <SourceActions slug={dataset.slug} confirms={dataset.confirms} confirmed={dataset.viewerConfirmed} />
      </div>
    );
  }
  return (
    <aside className="rounded border border-rule bg-surface p-3 text-sm">
      <p>
        This department&apos;s data was added by a user. Report it if you believe it came from the wrong source.{' '}
        <span className="text-muted">Source of data: </span>
        <SourceLink url={dataset.sourceUrl} />
      </p>
      <div className="mt-3">
        <SourceActions slug={dataset.slug} confirms={dataset.confirms} confirmed={dataset.viewerConfirmed} />
      </div>
    </aside>
  );
}
