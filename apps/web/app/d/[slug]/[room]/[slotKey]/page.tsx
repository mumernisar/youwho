import Link from 'next/link';
import type { Metadata } from 'next';
import { normalizeReg } from '@youwho/core';
import { getServices } from '@/server/services';
import { viewerHash } from '@/server/voter';
import { loadPage } from '@/server/page-data';
import { roomParams } from '@/server/schemas';
import { ErrorState } from '@/ui/error-state';
import { SourceNotice, SourceLink } from '@/ui/source-notice';
import { RoomGrid } from '@/ui/room-grid';
import { buildRoomModel } from '@/ui/room-model';
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
  if (!res.ok) return <ErrorState error={res.error} />;

  const data = res.data;
  const model = buildRoomModel(data, me);
  const mine = model.courses.find((c) => c.mine);
  const back = me ? { href: `/r/${me}`, text: 'Your papers' } : { href: `/d/${data.dataset.slug}`, text: data.dataset.label };

  return (
    <article className="pt-2">
      <Link href={back.href} className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">← {back.text}</Link>
      <h1 className="text-2xl font-semibold">
        {mine ? <><span className="font-mono">{mine.code}</span> · </> : null}Room <span className="font-mono">{data.room}</span>
      </h1>
      <p className="mt-1 text-muted">{fmtDateLong(data.slot.date)} · <span className="font-mono">{fmtRange(data.slot.start, data.slot.end)}</span></p>

      <div className="mt-4"><SourceNotice dataset={data.dataset} /></div>

      <RoomGrid model={model} me={me} roomName={data.room} />

      <footer className="mt-8 border-t border-rule pt-3 text-sm text-muted">
        Source of data: <SourceLink url={data.dataset.sourceUrl} />
      </footer>
    </article>
  );
}
