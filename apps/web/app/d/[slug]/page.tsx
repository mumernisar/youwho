import Link from 'next/link';
import type { Metadata } from 'next';
import { getServices } from '@/server/services';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { ErrorState } from '@/ui/error-state';
import { RefreshButton } from '@/ui/refresh-button';
import { SourceNotice } from '@/ui/source-notice';
import { count, fmtDate, fmtTime } from '@/ui/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Department' };

export default async function Department({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getServices();
  const res = await loadPage(async () => s.datasets.department(slug, await viewerHash(s)));
  if (!res.ok) return <ErrorState error={res.error} />;
  const { dataset, rooms, warnings } = res.data;

  return (
    <article className="pt-4">
      <h1 className="text-2xl font-semibold">{dataset.label}</h1>
      <p className="mt-1 font-mono text-sm text-muted">
        {count(dataset.students)} students · {count(dataset.seats)} seats · updated {dataset.stamp}
      </p>
      <div className="mt-4"><SourceNotice dataset={dataset} /></div>
      <div className="mt-4">
        <RefreshButton url={dataset.sourceUrl} waitMin={Math.max(0, Math.ceil((new Date(dataset.updatedAt).getTime() + 10 * 60_000 - Date.now()) / 60_000))} />
      </div>
      {warnings.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-muted">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}

      <h2 className="mt-10 mb-2 border-b border-rule pb-2 text-sm font-semibold uppercase tracking-wide text-muted">Rooms</h2>
      <ul className="divide-y divide-rule">
        {rooms.map((r) => (
          <li key={r.slug}>
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between py-2">
                <span className="font-mono">{r.room}</span>
                <span className="text-sm text-muted">{r.slots} {r.slots === 1 ? 'slot' : 'slots'}</span>
              </summary>
              <ul className="flex flex-wrap gap-2 pb-3">
                {r.slotKeys.map((k) => (
                  <li key={k}>
                    <Link href={`/d/${dataset.slug}/${r.slug}/${encodeURIComponent(k)}`} className="inline-flex min-h-6 items-center rounded border border-rule px-2 py-1 font-mono text-xs hover:border-ink">
                      {fmtDate(k.slice(0, 10))} {fmtTime(k.slice(11))}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </article>
  );
}
