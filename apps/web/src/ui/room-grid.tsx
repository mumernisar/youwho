'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColourBy, LegendItem, RoomModel, SeatModel } from './room-model';
import { ColourToggle, Legend } from './room-legend';
import { SeatSheet } from './seat-sheet';
import { hueStyle } from './palette';
import { Minus, Plus, Target } from './icons';

/** Zoom levels as multiples of the size that fits the card. */
const ZOOMS = [0.75, 1, 1.25, 1.5, 1.85];
// 20px seats with at least 4px between them meet the WCAG 2.2 target-spacing rule (24px).
const MIN_SEAT = 20;
const MAX_SEAT = 44;
const AXIS = 18;
const PAD = 16;
const gapFor = (seat: number) => Math.max(4, seat * 0.22);

/** Largest seat that fits `width`, so the whole room shows without scrolling when it can. */
function fitSeat(width: number, cols: number): number {
  const room = width - PAD - 2 * AXIS;
  let s = room / (cols + (cols + 1) * 0.22);
  if (gapFor(s) === 4) s = (room - (cols + 1) * 4) / cols;
  return Math.max(MIN_SEAT, Math.min(MAX_SEAT, s));
}

export function RoomGrid({ model, roomName, aside }: { model: RoomModel; roomName: string; aside?: React.ReactNode }) {
  const { dims, grid, extras, clash, others, me } = model;
  const [by, setBy] = useState<ColourBy>('course');
  const [spot, setSpot] = useState<string | null>(null);
  const [open, setOpen] = useState<SeatModel | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(40);
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const items = by === 'course' ? model.courses : model.sections;
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const keyOf = useCallback((s: SeatModel) => (by === 'course' ? `c${s.course}` : s.section), [by]);
  const courseOf = useMemo(() => new Map(model.courses.map((c) => [c.key, c])), [model.courses]);
  const cells = useMemo(() => new Map(grid.map((s) => [`${s.row}:${s.col}`, s])), [grid]);

  /** On load only the map pans to your seat; the button also brings the map into view. */
  const findMe = useCallback((fromButton: boolean) => {
    const el = root.current?.querySelector<HTMLElement>('[data-me="true"]');
    const box = scroller.current;
    if (!el || !box) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = fromButton && !reduce ? 'smooth' : 'auto';
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    box.scrollTo({ left: box.scrollLeft + a.left - b.left - (b.width - a.width) / 2, top: box.scrollTop + a.top - b.top - (b.height - a.height) / 2, behavior });
    if (fromButton) box.scrollIntoView({ block: 'nearest', behavior });
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setFit(fitSeat(el.clientWidth, Math.max(dims.cols, 1)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims.cols]);
  useEffect(() => findMe(false), [findMe, fit]);

  const describe = (s: SeatModel) => {
    const c = model.courseInfo[s.course];
    return `${s.label}, ${c?.code ?? ''} ${c?.title ?? ''}, ${s.name}, ${s.reg}${s.me ? ', you' : ''}`;
  };
  const firstFocus = me && me.row ? me : grid[0];
  const changeBy = (v: ColourBy) => {
    setBy(v);
    setSpot(null);
  };

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
    if (!d || !el) return;
    e.preventDefault();
    let r = Number(el.dataset.r);
    let c = Number(el.dataset.c);
    for (;;) {
      r += d[0]!;
      c += d[1]!;
      if (r < 1 || c < 1 || r > dims.rows || c > dims.cols) return;
      const next = root.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
      if (next) return next.focus();
    }
  }

  const seatProps = (s: SeatModel) => {
    const it = byKey.get(keyOf(s));
    return {
      style: hueStyle(it?.hue ?? 0),
      'data-tex': it?.tex ?? 0,
      'data-me': s.me,
      'data-dim': spot !== null && keyOf(s) !== spot,
      'aria-pressed': open?.id === s.id,
      'aria-label': describe(s),
      onClick: () => setOpen(s),
    };
  };

  const listSeat = (s: SeatModel) => {
    const c = model.courseInfo[s.course];
    return (
      <li key={s.id}>
        <button type="button" {...seatProps(s)} className={`flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand ${spot !== null && keyOf(s) !== spot ? 'opacity-30' : ''}`}>
          <span className="mini-seat" data-tex={byKey.get(keyOf(s))?.tex ?? 0} data-me={s.me} style={hueStyle(byKey.get(keyOf(s))?.hue ?? 0)} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{s.label}</span>
            <span className="block truncate text-xs text-muted">{c?.title}</span>
          </span>
          {s.me ? <span className="you-chip">You</span> : <span className="font-mono text-xs text-muted">{s.reg}</span>}
        </button>
      </li>
    );
  };

  const lists = (
    [
      ['Extra chairs at the back', extras],
      ['Clash room sittings', clash],
      ['Other seats', others],
    ] as const
  ).filter(([, l]) => l.length > 0);

  return (
    <div ref={root} className="room mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" style={{ '--cols': Math.max(dims.cols, 1), '--seat': `${Math.round(fit * ZOOMS[zoom]!)}px`, '--gap': `${Math.round(gapFor(fit * ZOOMS[zoom]!))}px`, '--axis': `${AXIS}px` } as React.CSSProperties} {...(spot !== null ? { 'data-spot': spot } : {})}>
      {aside && <div className="lg:hidden">{aside}</div>}
      <section className="card min-w-0 p-3 sm:p-4" aria-label="Seating plan">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
          <h2 className="text-base font-bold">Seating plan</h2>
          <div className="flex items-center gap-2">
            {me && me.row > 0 && (
              <button type="button" onClick={() => findMe(true)} className="btn btn-secondary btn-sm">
                <Target className="h-4 w-4" />
                Find me
              </button>
            )}
            {grid.length > 0 && (
              <div className="flex items-center rounded-xl ring-1 ring-line">
                <button type="button" aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)} className="btn btn-quiet btn-sm btn-icon h-9 min-h-9 w-9 rounded-r-none"><Minus className="h-4 w-4" /></button>
                <span className="w-11 text-center font-mono text-xs text-muted">{Math.round(ZOOMS[zoom]! * 100)}%</span>
                <button type="button" aria-label="Zoom in" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => z + 1)} className="btn btn-quiet btn-sm btn-icon h-9 min-h-9 w-9 rounded-l-none"><Plus className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </div>

        {grid.length > 0 ? (
          <div ref={scroller} className="room-floor max-h-[78dvh] overflow-auto">
            <div className="room-canvas">
              <div className="room-board" aria-hidden>FRONT OF ROOM</div>
              <div role="grid" aria-label={`Seats in room ${roomName}, row 1 at the front`} className="room-grid" onKeyDown={onKey}>
                <div role="row" className="contents">
                  <span role="columnheader" aria-label="Row" />
                  {Array.from({ length: dims.cols }, (_, i) => (
                    <span key={i} role="columnheader" aria-label={`Seat ${i + 1}`} className="room-axis">{i + 1}</span>
                  ))}
                  <span role="columnheader" aria-hidden />
                </div>
                {Array.from({ length: dims.rows }, (_, r) => (
                  <div role="row" key={r} className="contents">
                    <span role="rowheader" aria-label={`Row ${r + 1}`} className="room-axis">{r + 1}</span>
                    {Array.from({ length: dims.cols }, (_, c) => {
                      const s = cells.get(`${r + 1}:${c + 1}`);
                      if (!s) return <span key={c} role="gridcell" aria-label="Empty" className="seat-gap" />;
                      return (
                        <span key={c} role="gridcell" className="relative">
                          {s.me && <span className="seat-pin">YOU</span>}
                          <button type="button" className="seat block" data-r={r + 1} data-c={c + 1} tabIndex={s === firstFocus ? 0 : -1} title={`${s.label} · ${model.courseInfo[s.course]?.code ?? ''}`} {...seatProps(s)}>
                            {s.me && <span className="seat-ring" />}
                          </button>
                        </span>
                      );
                    })}
                    <span aria-hidden className="room-axis">{r + 1}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-center text-xs font-medium tracking-[0.2em] text-muted">BACK OF ROOM</p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">This room has no seat grid. Every seat is listed below.</p>
        )}

        {lists.map(([title, list]) => (
          <div key={title} className="mt-5">
            <h3 className="eyebrow mb-2 px-1">{title}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">{list.map(listSeat)}</ul>
          </div>
        ))}
      </section>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {aside && <div className="hidden lg:block">{aside}</div>}
        <section className="card p-4" aria-labelledby="legend-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="legend-title" className="text-base font-bold">In this room</h2>
            <ColourToggle value={by} onChange={changeBy} />
          </div>
          <Legend items={items} spot={spot} onSpot={setSpot} />
          {spot && (
            <button type="button" onClick={() => setSpot(null)} className="btn btn-quiet btn-sm mt-2 w-full">Show all seats</button>
          )}
        </section>
      </aside>

      <SeatSheet
        seat={open}
        me={me}
        course={(s) => {
          const c = courseOf.get(`c${s.course}`) as LegendItem;
          return { ...c, titleFull: model.courseInfo[s.course]?.title ?? c.title };
        }}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
