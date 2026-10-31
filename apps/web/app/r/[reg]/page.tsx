import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { normalizeReg } from '@youwho/core';
import { getServices } from '@/server/services';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import type { PaperView } from '@/server/schemas';
import { DeptBadge } from '@/ui/dept-badge';
import { ErrorState } from '@/ui/error-state';
import { ArrowRight, Chair, Clock, Door, Calendar } from '@/ui/icons';
import { PageNav } from '@/ui/page-nav';
import { assignHues, dayHue, hueStyle, initials } from '@/ui/palette';
import { SourceNotice } from '@/ui/source-notice';
import { dateParts, fmtDate, fmtDateLong, fmtTime, seatText } from '@/ui/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your papers', robots: { index: false } };

function groupByDate(papers: PaperView[]): [string, PaperView[]][] {
  const m = new Map<string, PaperView[]>();
  for (const p of papers) m.set(p.date, [...(m.get(p.date) ?? []), p]);
  return [...m.entries()];
}

function PaperCard({ p, slug, reg, hue }: { p: PaperView; slug: string; reg: string; hue: number }) {
  const clash = p.position.kind === 'clash';
  return (
    <Link
      href={`/d/${slug}/${p.roomSlug}/${encodeURIComponent(p.slotKey)}?me=${reg}`}
      style={hueStyle(hue)}
      className="card-link group flex overflow-hidden"
    >
      <span aria-hidden className="hue-bar w-1.5 flex-none" />
      <span className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <span className="flex items-center gap-2 font-mono text-sm text-ink-2 sm:w-36 sm:flex-col sm:items-start sm:gap-0.5">
          <span className="flex items-center gap-1.5 text-base font-semibold text-ink"><Clock className="h-4 w-4 text-muted" />{fmtTime(p.start)}</span>
          <span className="text-muted">to {fmtTime(p.end)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg leading-snug font-semibold">{p.course.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="hue-chip font-mono">{p.course.code}</span>
            {p.course.teacher && <span className="text-sm text-muted">{p.course.teacher}</span>}
            {p.section && p.section !== '—' && <span className="chip">With {p.section}</span>}
          </span>
        </span>
        <span className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <span className="chip font-semibold text-ink"><Door className="h-3.5 w-3.5" />{clash ? 'Clash Room' : `Room ${p.room}`}</span>
          <span className="chip font-semibold text-ink"><Chair className="h-3.5 w-3.5" />{seatText(p.position)}</span>
        </span>
        <span className="flex items-center justify-between gap-2 border-t border-line pt-3 text-sm font-semibold text-brand sm:border-0 sm:pt-0">
          <span className="sm:sr-only">View room map</span>
          <span className="go"><ArrowRight className="h-4 w-4" /></span>
        </span>
      </span>
    </Link>
  );
}

export default async function Papers({ params }: { params: Promise<{ reg: string }> }) {
  const raw = decodeURIComponent((await params).reg);
  const canonical = normalizeReg(raw);
  if (canonical && canonical !== raw) redirect(`/r/${canonical}`);

  const s = getServices();
  const res = await loadPage(async () => s.lookup.lookup(raw, await viewerHash(s)));
  if (!res.ok) {
    return (
      <>
        <PageNav back={{ href: '/', label: 'Search again' }} crumbs={[{ href: '/', label: 'Home' }, { label: raw }]} />
        <div className="card mt-4"><ErrorState error={res.error} /></div>
      </>
    );
  }
  const { reg, name, departments } = res.data;
  const all = departments.flatMap((d) => d.papers);
  const first = all[0];
  // Distinct colours across this student's own courses, in the order they sit them.
  const hues = assignHues([...new Set([...all.map((p) => p.course.code), ...departments.flatMap((d) => d.tba.map((c) => c.code))])]);
  const hueOf = (code: string) => hues.get(code)?.hue ?? 262;

  return (
    <article>
      <PageNav back={{ href: '/', label: 'Home' }} crumbs={[{ href: '/', label: 'Home' }, { label: reg }]} />

      <header className="card mt-2 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <span aria-hidden className="grid h-16 w-16 flex-none place-items-center rounded-2xl bg-brand text-xl font-bold text-brand-ink">{initials(name)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
          <p className="mt-1 font-mono text-sm text-muted">{reg}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip"><Calendar className="h-3.5 w-3.5" />{all.length} {all.length === 1 ? 'paper' : 'papers'}</span>
          {first && <span className="chip">First on {fmtDate(first.date)}</span>}
        </div>
      </header>

      {departments.map(({ dataset, papers, tba }) => (
        <section key={dataset.slug} className="mt-10" aria-labelledby={`d-${dataset.slug}`}>
          <div className="mb-4 flex items-center gap-3">
            <DeptBadge slug={dataset.slug} label={dataset.label} />
            <div className="min-w-0">
              <h2 id={`d-${dataset.slug}`} className="text-xl font-bold tracking-tight">
                <Link href={`/d/${dataset.slug}`} className="hover:underline">{dataset.label}</Link>
              </h2>
              <p className="text-sm text-muted">Updated {dataset.stamp}</p>
            </div>
          </div>
          <SourceNotice dataset={dataset} compact />

          <div className="mt-6 space-y-8">
            {groupByDate(papers).map(([date, list]) => {
              const d = dateParts(date);
              return (
                <div key={date} className="grid gap-3 sm:grid-cols-[4.5rem_1fr] sm:gap-5">
                  <div style={hueStyle(dayHue(date))} className="hue-soft hue-ink flex h-fit items-center gap-3 rounded-2xl px-4 py-2 sm:sticky sm:top-4 sm:flex-col sm:gap-0 sm:px-0 sm:py-3 sm:text-center">
                    <span className="text-xs font-bold tracking-wider uppercase">{d.weekday}</span>
                    <span className="text-2xl leading-none font-extrabold sm:text-3xl">{d.day}</span>
                    <span className="text-xs font-semibold uppercase">{d.month}</span>
                  </div>
                  <ul className="space-y-3">
                    {list.map((p, i) => (
                      <li key={`${p.slotKey}-${i}`}><PaperCard p={p} slug={dataset.slug} reg={reg} hue={hueOf(p.course.code)} /></li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {tba.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-[4.5rem_1fr] sm:gap-5">
                <div className="flex h-fit items-center justify-center rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm font-bold text-muted">TBA</div>
                <ul className="space-y-3">
                  {tba.map((c) => (
                    <li key={c.code} className="rounded-2xl border-2 border-dashed border-line p-4">
                      <p className="text-lg font-semibold">{c.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <span style={hueStyle(hueOf(c.code))} className="hue-chip font-mono">{c.code}</span>
                        <span className="text-sm text-muted">Date, time and room not announced yet.</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      ))}
    </article>
  );
}
