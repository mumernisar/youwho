import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { normalizeReg } from '@youwho/core';
import { getServices } from '@/server/services';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { ErrorState } from '@/ui/error-state';
import { SourceNotice } from '@/ui/source-notice';
import { fmtDate, fmtRange, seatText } from '@/ui/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your papers', robots: { index: false } };

export default async function Papers({ params }: { params: Promise<{ reg: string }> }) {
  const raw = decodeURIComponent((await params).reg);
  const canonical = normalizeReg(raw);
  if (canonical && canonical !== raw) redirect(`/r/${canonical}`);

  const s = getServices();
  const res = await loadPage(async () => s.lookup.lookup(raw, await viewerHash(s)));
  if (!res.ok) return <ErrorState error={res.error} />;
  const { reg, name, departments } = res.data;

  return (
    <article className="pt-4">
      <h1 className="text-2xl font-semibold">{name}</h1>
      <p className="font-mono text-sm text-muted">{reg}</p>

      {departments.map(({ dataset, papers, tba }) => (
        <section key={dataset.slug} className="mt-10" aria-labelledby={`d-${dataset.slug}`}>
          <h2 id={`d-${dataset.slug}`} className="text-lg font-semibold">
            <Link href={`/d/${dataset.slug}`} className="hover:underline">{dataset.label}</Link>
          </h2>
          <div className="mt-1 mb-3"><SourceNotice dataset={dataset} compact /></div>

          <ul className="divide-y divide-rule border-y border-rule">
            {papers.map((p, i) => (
              <li key={`${p.slotKey}-${i}`}>
                <Link
                  href={`/d/${dataset.slug}/${p.roomSlug}/${encodeURIComponent(p.slotKey)}?me=${reg}`}
                  className="grid min-h-11 grid-cols-[5.5rem_1fr] gap-x-4 gap-y-1 py-3 hover:bg-surface sm:grid-cols-[6rem_1fr_auto]"
                >
                  <span>
                    <span className="block font-medium">{fmtDate(p.slotKey.slice(0, 10))}</span>
                    <span className="block font-mono text-xs text-muted">{fmtRange(p.start, p.end)}</span>
                  </span>
                  <span>
                    <span className="font-mono text-sm">{p.course.code}</span>{' '}
                    <span>{p.course.title}</span>
                    {p.section && <span className="block font-mono text-xs text-muted">sitting with {p.section}</span>}
                  </span>
                  <span className="col-start-2 font-mono text-sm sm:col-start-3 sm:text-right">
                    {p.room}
                    <span className="block text-xs text-muted">{seatText(p.position)}</span>
                  </span>
                </Link>
              </li>
            ))}
            {tba.map((c) => (
              <li key={c.code} className="grid grid-cols-[5.5rem_1fr] gap-x-4 py-3 sm:grid-cols-[6rem_1fr_auto]">
                <span className="font-mono text-sm text-muted">TBA</span>
                <span>
                  <span className="font-mono text-sm">{c.code}</span> <span>{c.title}</span>
                  <span className="block text-xs text-muted">Date, time and room not announced yet.</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
