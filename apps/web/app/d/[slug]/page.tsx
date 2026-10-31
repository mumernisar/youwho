import Link from 'next/link';
import type { Metadata } from 'next';
import { getServices } from '@/server/services';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { DeptBadge } from '@/ui/dept-badge';
import { ErrorState } from '@/ui/error-state';
import { ChevronDown, Door, Users, Chair, Calendar } from '@/ui/icons';
import { PageNav } from '@/ui/page-nav';
import { dayHue, hueStyle } from '@/ui/palette';
import { RefreshButton } from '@/ui/refresh-button';
import { SourceNotice } from '@/ui/source-notice';
import { count, fmtDate, fmtTime } from '@/ui/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Department' };

export default async function Department({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getServices();
  const res = await loadPage(async () => s.datasets.department(slug, await viewerHash(s)));
  if (!res.ok) return <div className="card mt-6"><ErrorState error={res.error} /></div>;
  const { dataset, rooms, warnings } = res.data;
  const waitMin = Math.max(0, Math.ceil((new Date(dataset.updatedAt).getTime() + 10 * 60_000 - Date.now()) / 60_000));
  const stats = [
    { icon: Users, label: 'Students', value: count(dataset.students) },
    { icon: Chair, label: 'Seats', value: count(dataset.seats) },
    { icon: Door, label: 'Rooms', value: String(rooms.length) },
    { icon: Calendar, label: 'Updated', value: dataset.stamp },
  ];

  return (
    <article>
      <PageNav back={{ href: '/', label: 'Home' }} crumbs={[{ href: '/', label: 'Home' }, { label: dataset.label }]} />

      <header className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <DeptBadge slug={dataset.slug} label={dataset.label} size="lg" />
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{dataset.label}</h1>
            <p className="mt-1 text-sm text-muted">Exam seating plan</p>
          </div>
        </div>
        <RefreshButton url={dataset.sourceUrl} waitMin={waitMin} />
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="card p-4">
            <dt className="flex items-center gap-2 text-sm text-muted"><Icon className="h-4 w-4" />{label}</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6"><SourceNotice dataset={dataset} /></div>
      {warnings.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 rounded-xl border border-line bg-surface-2 py-3 pr-4 pl-8 text-sm text-muted">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <section className="mt-10" aria-labelledby="rooms">
        <h2 id="rooms" className="text-2xl font-bold tracking-tight">Rooms</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Open a room, then pick an exam slot to see its seating plan.</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.slug}>
              <details className="card group overflow-hidden">
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 p-4 transition hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-brand-soft text-brand"><Door className="h-5 w-5" /></span>
                  <span className="flex-1">
                    <span className="block font-mono text-lg font-semibold">{r.room}</span>
                    <span className="block text-sm text-muted">{r.slots} {r.slots === 1 ? 'exam slot' : 'exam slots'}</span>
                  </span>
                  <ChevronDown className="h-5 w-5 text-muted transition group-open:rotate-180" />
                </summary>
                <ul className="grid grid-cols-2 gap-2 border-t border-line p-3 sm:grid-cols-3">
                  {r.slotKeys.map((k) => (
                    <li key={k}>
                      <Link href={`/d/${dataset.slug}/${r.slug}/${encodeURIComponent(k)}`} style={hueStyle(dayHue(k.slice(0, 10)))} className="hue-soft flex flex-col rounded-xl px-3 py-2 transition hover:ring-2 hover:ring-brand">
                        <span className="hue-ink text-sm font-semibold">{fmtDate(k.slice(0, 10))}</span>
                        <span className="font-mono text-xs text-ink-2">{fmtTime(k.slice(11, 16))} – {fmtTime(k.slice(17))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
