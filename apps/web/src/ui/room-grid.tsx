'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { CourseChip, RoomModel, SeatModel } from './room-model';

const hueStyle = (c: CourseChip | undefined) => ({ '--h': c?.hue ?? 0 }) as React.CSSProperties;

export function RoomGrid({ model, me, roomName }: { model: RoomModel; me: string | null; roomName: string }) {
  const { dims, courses, grid, extras, clash, others } = model;
  const [spot, setSpot] = useState<number | null>(null);
  const [open, setOpen] = useState<SeatModel | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const byCourse = useMemo(() => new Map(courses.map((c) => [c.idx, c])), [courses]);
  const cells = useMemo(() => new Map(grid.map((s) => [`${s.row}:${s.col}`, s])), [grid]);

  // Bring your own seat into view once, without animation.
  useEffect(() => {
    root.current?.querySelector('[data-me="true"]')?.scrollIntoView({ block: 'center', inline: 'center' });
  }, []);

  const label = (s: SeatModel) => `${s.label}, ${byCourse.get(s.course)?.code ?? ''} ${byCourse.get(s.course)?.title ?? ''}, ${s.name}, ${s.reg}`;
  const firstFocus = (me && grid.find((s) => s.me)) || grid[0];

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
    if (!d || !el) return;
    e.preventDefault();
    let r = Number(el.dataset.r);
    let c = Number(el.dataset.c);
    // Skip empty positions so the arrow keys land on the next real seat in that direction.
    for (;;) {
      r += d[0]!;
      c += d[1]!;
      if (r < 1 || c < 1 || r > dims.rows || c > dims.cols) return;
      const next = root.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
      if (next) return next.focus();
    }
  }

  const chip = (c: CourseChip) => (
    <li key={c.idx}>
      <button
        type="button"
        aria-pressed={spot === c.idx}
        onClick={() => setSpot(spot === c.idx ? null : c.idx)}
        className="flex min-h-11 items-center gap-2 rounded border border-rule px-3 text-sm aria-pressed:border-ink"
      >
        <span className="swatch" data-tex={c.tex} data-mine={c.mine} style={hueStyle(c)} />
        <span className="font-mono">{c.code}</span>
        <span className="font-mono text-muted">{c.count}</span>
      </button>
    </li>
  );

  const listSeat = (s: SeatModel) => (
    <li key={s.reg + s.label}>
      <button
        type="button"
        onClick={() => setOpen(s)}
        data-dim={spot !== null && s.course !== spot}
        aria-label={label(s)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded border border-rule px-3 py-2 text-left text-sm data-[dim=true]:opacity-25"
      >
        <span>{s.label}{s.me && <strong className="ml-2 text-accent">you</strong>}</span>
        <span className="font-mono text-xs text-muted">{byCourse.get(s.course)?.code} · {s.reg}</span>
      </button>
    </li>
  );

  return (
    <div
      ref={root}
      className="room mt-6"
      {...(spot !== null ? { 'data-spot': spot } : {})}
      style={{ '--cols': Math.max(dims.cols, 1) } as React.CSSProperties}
    >
      {grid.length > 0 && (
        <>
          <div className="mx-3 rounded bg-ink py-1 text-center font-mono text-xs tracking-[0.3em] text-bg" aria-hidden>FRONT</div>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div role="grid" aria-label={`Seats in room ${roomName}`} className="room-grid" onKeyDown={onKey}>
              <div role="row" className="contents">
                <span role="columnheader" aria-label="Row" className="room-axis" />
                {Array.from({ length: dims.cols }, (_, i) => <span key={i} role="columnheader" aria-label={`Seat ${i + 1}`} className="room-axis">{i + 1}</span>)}
              </div>
              {Array.from({ length: dims.rows }, (_, r) => (
                <div role="row" key={r} className="contents">
                  <span role="rowheader" aria-label={`Row ${r + 1}`} className="room-axis">{r + 1}</span>
                  {Array.from({ length: dims.cols }, (_, c) => {
                    const s = cells.get(`${r + 1}:${c + 1}`);
                    if (!s) return <span key={c} role="gridcell" className="seat-slot" aria-hidden />;
                    const ch = byCourse.get(s.course);
                    return (
                      <span key={c} role="gridcell" className="contents">
                        <button
                          type="button"
                          className="seat"
                          style={hueStyle(ch)}
                          data-r={r + 1}
                          data-c={c + 1}
                          data-tex={ch?.tex ?? 0}
                          data-me={s.me}
                          data-mine-course={ch?.mine ?? false}
                          data-dim={spot !== null && s.course !== spot}
                          tabIndex={s === firstFocus ? 0 : -1}
                          aria-label={label(s)}
                          onClick={() => setOpen(s)}
                        />
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {extras.length > 0 && (
        <section className="mt-4" aria-label="Extra chairs">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Extra chairs (back of room)</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{extras.map(listSeat)}</ul>
        </section>
      )}
      {clash.length > 0 && (
        <section className="mt-4" aria-label="Clash room sittings">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Clash room sittings</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{clash.map(listSeat)}</ul>
        </section>
      )}
      {others.length > 0 && (
        <section className="mt-4" aria-label="Other seats">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Other seats</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{others.map(listSeat)}</ul>
        </section>
      )}

      <ul className="mt-6 flex flex-wrap gap-2" aria-label="Courses in this room">{courses.map(chip)}</ul>

      <Dialog.Root open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border border-rule bg-surface p-5 pb-8 text-ink sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-96 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
            {open && (
              <>
                <Dialog.Title className="text-lg font-semibold">{open.name}{open.me && <span className="ml-2 text-sm font-medium text-accent">you</span>}</Dialog.Title>
                <Dialog.Description className="font-mono text-sm text-muted">{open.reg}</Dialog.Description>
                <dl className="mt-4 space-y-2 text-sm">
                  <div><dt className="text-muted">Course</dt><dd><span className="font-mono">{byCourse.get(open.course)?.code}</span> {byCourse.get(open.course)?.title}</dd></div>
                  {open.sectionDiffers && <div><dt className="text-muted">Section</dt><dd className="font-mono">{open.section}</dd></div>}
                  <div><dt className="text-muted">Seat</dt><dd>{open.label}</dd></div>
                </dl>
                <Dialog.Close className="mt-5 min-h-11 w-full rounded border border-ink px-4 text-sm font-medium">Close</Dialog.Close>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
