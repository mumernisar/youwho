import type { Metadata } from 'next';
import { normalizeReg } from '@youwho/core';
import { getServices } from '@/server/services';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { roomParams } from '@/server/schemas';
import { ErrorState } from '@/ui/error-state';
import { Calendar, Chair, Clock, Door, Layers, Users } from '@/ui/icons';
import { PageNav } from '@/ui/page-nav';
import { hueStyle } from '@/ui/palette';
import { RoomGrid } from '@/ui/room-grid';
import { buildRoomModel } from '@/ui/room-model';
import { SourceNotice } from '@/ui/source-notice';
import { fmtDateLong, fmtRange } from '@/ui/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Room', robots: { index: false } };

export default async function Room({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; room: string; slotKey: string }>;
  searchParams: Promise<{ me?: string }>;
}) {
  const p = await params;
  const input = { slug: p.slug, room: p.room, slotKey: decodeURIComponent(p.slotKey) };
  const me = normalizeReg((await searchParams).me ?? '');
  const s = getServices();

  const res = await loadPage(async () => {
    const parsed = roomParams.safeParse(input);
    if (!parsed.success) return s.rooms.view({ slug: input.slug, room: input.room, slotKey: '' }, null);
    return s.rooms.view(parsed.data, await viewerHash(s));
  });
  if (!res.ok) return <div className="card mt-6"><ErrorState error={res.error} /></div>;

  const data = res.data;
  const model = buildRoomModel(data, me);
  const mine = model.courses.find((c) => c.mine);
  const back = me ? { href: `/r/${me}`, label: 'Your papers' } : { href: `/d/${data.dataset.slug}`, label: data.dataset.label };
  const crumbs = me
    ? [{ href: '/', label: 'Home' }, { href: `/r/${me}`, label: me }, { label: `Room ${data.room}` }]
    : [{ href: '/', label: 'Home' }, { href: `/d/${data.dataset.slug}`, label: data.dataset.label }, { label: `Room ${data.room}` }];

  const yourSeat = model.me && mine && (
    <section style={hueStyle(mine.hue)} className="card overflow-hidden" aria-label="Your seat">
      {/* Seat and room side by side, the two things to find on the day. */}
      <div className="flex items-stretch gap-4 bg-accent px-4 py-3 text-accent-ink">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wider uppercase opacity-80">Your seat</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight">{model.me.label}</p>
        </div>
        <div className="max-w-[45%] flex-none border-l border-accent-ink/20 pl-4 text-right">
          <p className="text-xs font-bold tracking-wider uppercase opacity-80">Room</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight break-words">{data.room}</p>
        </div>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <p className="font-semibold">{model.me.name}</p>
        <p className="font-mono text-muted">{model.me.reg}</p>
        <p className="flex items-center gap-2"><span className="mini-seat" data-tex={mine.tex} />{mine.title}</p>
      </div>
    </section>
  );

  return (
    <article>
      <PageNav back={back} crumbs={crumbs} />

      <header className="mt-2">
        <p className="eyebrow flex items-center gap-2"><Door className="h-4 w-4" />Room {data.room} · {data.dataset.label}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{mine ? mine.title : `Room ${data.room}`}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {mine?.code && <span style={hueStyle(mine.hue)} className="hue-chip font-mono">{mine.code}</span>}
          <span className="chip"><Calendar className="h-3.5 w-3.5" />{fmtDateLong(data.slot.date)}</span>
          <span className="chip font-mono"><Clock className="h-3.5 w-3.5" />{fmtRange(data.slot.start, data.slot.end)}</span>
          <span className="chip"><Users className="h-3.5 w-3.5" />{data.seats.length} students</span>
          <span className="chip"><Layers className="h-3.5 w-3.5" />{model.courses.length} {model.courses.length === 1 ? 'course' : 'courses'}</span>
          {!model.me && me && <span className="chip"><Chair className="h-3.5 w-3.5" />You are not in this room</span>}
        </div>
      </header>

      <RoomGrid model={model} roomName={data.room} aside={yourSeat} />

      <div className="mt-8"><SourceNotice dataset={data.dataset} /></div>
    </article>
  );
}
