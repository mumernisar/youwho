import Link from 'next/link';
import { getServices } from '@/server/services';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { RollForm } from '@/ui/roll-form';
import { ErrorState } from '@/ui/error-state';
import { count, fmtUpdated, sourceHost } from '@/ui/format';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const s = getServices();
  const board = await loadPage(async () => s.datasets.list(await viewerHash(s)));
  return (
    <>
      <section className="pt-10 text-center">
        <h1 className="mb-6 text-xl font-semibold">Who sits around you?</h1>
        <RollForm />
      </section>

      <section className="mt-16" aria-labelledby="board">
        <h2 id="board" className="mb-3 border-b border-rule pb-2 text-sm font-semibold uppercase tracking-wide text-muted">On the board</h2>
        {!board.ok ? (
          <ErrorState error={board.error} compact />
        ) : board.data.length === 0 ? (
          <p className="py-6 text-muted">No departments yet.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {board.data.map((d) => (
              <li key={d.slug}>
                <Link href={`/d/${d.slug}`} className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 hover:bg-surface">
                  <span>
                    <span className="font-medium">{d.label}</span>
                    <span className="block font-mono text-xs text-muted">{sourceHost(d.sourceUrl)}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">
                    updated {fmtUpdated(d.updatedAt)} · {count(d.students)} students · {d.confirms} looks right
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-muted">Adding departments is coming soon.</p>
      </section>
    </>
  );
}
