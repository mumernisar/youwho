'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MIRRORED, type ColourBy, type LegendItem, type RoomModel, type SeatModel } from './room-model';
import { ColourToggle, Legend } from './room-legend';
import { SeatPopover } from './seat-popover';
import { rollOrderModel } from './roll-order';
import { formatRegInput } from './format';
import { hueStyle } from './palette';
import { CornerBottomRight, CornerTopRight, Minus, Plus, Search, X } from './icons';

/** Zoom levels as multiples of the size that fits the card. */
const ZOOMS = [0.75, 1, 1.25, 1.5, 1.85];
// 20px seats with at least 4px between them meet the WCAG 2.2 target-spacing rule (24px).
const MIN_SEAT = 20;
const MAX_SEAT = 44;
/** Under this the map drops the YOU tab, which would cover the row in front. */
const SMALL_SEAT = 28;
const PAD = 8;
/** Narrow maps keep row numbers on the left only, in a thinner column. */
const NARROW = 480;
const gapFor = (seat: number) => Math.max(4, seat * 0.22);
const normReg = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** A seat by roll number: the exact number, or the end of one if only one seat in the room matches. */
function findSeat(seats: SeatModel[], query: string): SeatModel | null {
  const q = normReg(query);
  if (!q) return null;
  const exact = seats.find((s) => normReg(s.reg) === q);
  if (exact) return exact;
  const tail = seats.filter((s) => normReg(s.reg).endsWith(q));
  return tail.length === 1 ? tail[0]! : null;
}

interface Fit {
  seat: number;
  axis: number;
  bothAxes: boolean;
}

/** Largest seat that fits `width`, so the whole room shows without scrolling when it can. */
function fitRoom(width: number, cols: number): Fit {
  const bothAxes = width >= NARROW;
  const axis = bothAxes ? 18 : 14;
  const axes = bothAxes ? 2 : 1;
  const gaps = cols + axes - 1;
  const room = width - PAD - axes * axis;
  let s = room / (cols + gaps * 0.22);
  if (gapFor(s) === 4) s = (room - gaps * 4) / cols;
  return { seat: Math.max(MIN_SEAT, Math.min(MAX_SEAT, s)), axis, bothAxes };
}

type Layout = 'plan' | 'roll';

export function RoomGrid({ model: official, roomName, aside }: { model: RoomModel; roomName: string; aside?: React.ReactNode }) {
  // Roll order re-seats the same students on the same grid; the published plan is the default.
  const [layout, setLayout] = useState<Layout>('plan');
  const model = useMemo(() => (layout === 'roll' ? rollOrderModel(official) : official), [layout, official]);
  const { dims, grid, extras, clash, others, me } = model;
  const [by, setBy] = useState<ColourBy>('course');
  const [spot, setSpot] = useState<string | null>(null);
  const [open, setOpen] = useState<SeatModel | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<Fit>({ seat: 40, axis: 18, bothAxes: true });
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<SeatModel | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const seatPx = fit.seat * ZOOMS[zoom]!;
  const mine = model.mySection;

  const items = by === 'course' ? model.courses : model.sections;
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const keyOf = useCallback((s: SeatModel) => (by === 'course' ? `c${s.course}` : s.section), [by]);
  const courseOf = useMemo(() => new Map(model.courses.map((c) => [c.key, c])), [model.courses]);
  const cells = useMemo(() => new Map(grid.map((s) => [`${s.row}:${s.col}`, s])), [grid]);
  /** Seat numbers in screen order, left to right. */
  const cols = useMemo(() => Array.from({ length: dims.cols }, (_, i) => (MIRRORED ? dims.cols - i : i + 1)), [dims.cols]);

  /** Centres a seat in the map. On load it pans to your seat; a search also brings the map into view. */
  const reveal = useCallback((selector: string, fromSearch: boolean) => {
    const el = root.current?.querySelector<HTMLElement>(selector);
    const box = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = fromSearch && !reduce ? 'smooth' : 'auto';
    // Seats in the lists under the map are not inside the scroller.
    if (!box || !box.contains(el)) return void (fromSearch && el.scrollIntoView({ block: 'center', behavior }));
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    box.scrollTo({ left: box.scrollLeft + a.left - b.left - (b.width - a.width) / 2, top: box.scrollTop + a.top - b.top - (b.height - a.height) / 2, behavior });
    if (fromSearch) box.scrollIntoView({ block: 'nearest', behavior });
  }, []);
  const findMe = useCallback(() => reveal('[data-me="true"]', false), [reveal]);
  const allSeats = useMemo(() => [...grid, ...extras, ...clash, ...others], [grid, extras, clash, others]);
  useEffect(() => {
    if (found) reveal('[data-found="true"]', true);
  }, [found, reveal]);
  const onFind = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normReg(query)) return;
    const hit = findSeat(allSeats, query);
    setFound(hit);
    setMissed(hit ? null : query.trim().toUpperCase());
  };
  const closeFind = () => {
    setFindOpen(false);
    setQuery('');
    setFound(null);
    setMissed(null);
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setFit(fitRoom(el.clientWidth, Math.max(dims.cols, 1)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims.cols]);
  useEffect(() => findMe(), [findMe, fit, layout]);
  const changeLayout = (v: Layout) => {
    setLayout(v);
    setOpen(null);
  };

  const describe = (s: SeatModel) => {
    const c = model.courseInfo[s.course];
    return `${s.label}, ${c?.code ?? ''} ${c?.title ?? ''}, ${s.name}, ${s.reg}${s.me ? ', you' : ''}${s.mySection ? ', your section' : ''}`;
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
      c += MIRRORED ? -d[1]! : d[1]!;
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
      'data-found': found?.id === s.id,
      'data-seat': '',
      'aria-pressed': open?.id === s.id,
      'aria-label': describe(s),
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        anchor.current = e.currentTarget;
        setOpen((cur) => (cur?.id === s.id ? null : s));
      },
    };
  };
  const tag = (s: SeatModel) => (s.mySection && mine ? <span aria-hidden className="seat-tag">{mine.tag}</span> : null);

  const listSeat = (s: SeatModel) => {
    const c = model.courseInfo[s.course];
    return (
      <li key={s.id}>
        <button type="button" {...seatProps(s)} className={`flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand data-[found=true]:border-brand data-[found=true]:ring-2 data-[found=true]:ring-brand ${spot !== null && keyOf(s) !== spot ? 'opacity-30' : ''}`}>
          <span className="mini-seat" data-tex={byKey.get(keyOf(s))?.tex ?? 0} data-me={s.me} style={hueStyle(byKey.get(keyOf(s))?.hue ?? 0)}>
            {tag(s)}
          </span>
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
    <div
      ref={root}
      className="room mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      style={{ '--cols': Math.max(dims.cols, 1), '--seat': `${Math.floor(seatPx)}px`, '--gap': `${Math.floor(gapFor(seatPx))}px`, '--axis': `${fit.axis}px` } as React.CSSProperties}
      data-small={seatPx < SMALL_SEAT}
      data-axes={fit.bothAxes ? 2 : 1}
      {...(spot !== null ? { 'data-spot': spot } : {})}
    >
      {aside && <div className="lg:hidden">{aside}</div>}
      {/* Laid out by the card's own width, not the screen's: beside the legend on a tablet it is narrow. */}
      <section className="card @container min-w-0 p-2 sm:p-4" aria-label="Seating plan">
        {/* Narrow card: controls go under the view switch, and the search box opens under them on the left.
            Wide card: both sit on the right. One breakpoint for both keeps the box under the Find button. */}
        <div className="flex flex-col items-start gap-2 px-1 pb-3 @2xl:flex-row @2xl:justify-between">
          <div className="min-w-0">
            {official.grid.length > 0 ? (
              <>
                <h2 className="sr-only">Seating plan</h2>
                {/* The view switch doubles as the card's title, so it costs no extra row. */}
                <div role="tablist" aria-label="Seating view" className="inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-line">
                  {(
                    [
                      ['plan', 'Official plan'],
                      ['roll', 'Roll order'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={layout === v}
                      aria-controls="seat-map"
                      onClick={() => changeLayout(v)}
                      className="min-h-8 rounded-lg px-3 text-sm font-bold text-muted transition aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <h2 className="text-base font-bold">Seating plan</h2>
            )}
            {grid.length > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                {MIRRORED ? 'Left and right as the invigilator at the front sees it. Seat 1 is on your right.' : 'Seat 1 is on your left as you face the front.'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={findOpen}
              aria-controls="find-seat"
              onClick={() => (findOpen ? closeFind() : (setFindOpen(true), requestAnimationFrame(() => findInput.current?.focus())))}
              className="btn btn-secondary btn-sm"
            >
              <Search className="h-4 w-4" />
              Find
            </button>
            {grid.length > 0 && (
              <div className="flex items-center rounded-xl ring-1 ring-line">
                <button type="button" aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)} className="btn btn-quiet btn-sm btn-icon h-9 min-h-9 w-9 rounded-r-none"><Minus className="h-4 w-4" /></button>
                <span className="w-11 text-center font-mono text-xs text-muted">{Math.round(ZOOMS[zoom]! * 100)}%</span>
                <button type="button" aria-label="Zoom in" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => z + 1)} className="btn btn-quiet btn-sm btn-icon h-9 min-h-9 w-9 rounded-l-none"><Plus className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </div>

        {findOpen && (
          <form id="find-seat" role="search" onSubmit={onFind} className="max-w-md px-1 pt-1 pb-4 @2xl:ml-auto">
            <div className="flex gap-2">
              <label htmlFor="find-roll" className="sr-only">Roll number</label>
              <input
                ref={findInput}
                id="find-roll"
                value={query}
                onChange={(e) => {
                  setQuery(formatRegInput(e.target.value));
                  setMissed(null);
                }}
                onKeyDown={(e) => e.key === 'Escape' && closeFind()}
                placeholder="e.g. FA24-BSE-058"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="search"
                className="field min-h-10 min-w-0 flex-1 font-mono text-sm"
              />
              <button type="submit" className="btn btn-primary btn-sm min-h-10">Find</button>
              <button type="button" onClick={closeFind} aria-label="Close search" className="btn btn-quiet btn-sm btn-icon h-10 min-h-10 w-10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p aria-live="polite" className="mt-2.5 text-sm empty:mt-0">
              {missed ? (
                <span className="font-semibold text-danger">Not in this room</span>
              ) : found ? (
                <button type="button" onClick={() => reveal('[data-found="true"]', true)} className="text-left">
                  <span className="font-semibold">{found.name}</span>
                  <span className="text-muted"> · {found.label}</span>
                  {found.me && <span className="you-chip ml-2">You</span>}
                </button>
              ) : null}
            </p>
          </form>
        )}

        {grid.length > 0 ? (
          <div ref={scroller} id="seat-map" role="tabpanel" aria-label={layout === 'roll' ? 'Roll order' : 'Official plan'} className="room-floor max-h-[78dvh] overflow-auto">
            <div className="room-canvas">
              <div className={`room-corner-row ${MIRRORED ? 'flex-row' : 'flex-row-reverse'}`}>
                {layout === 'roll' ? <span className="room-note">Roll order · <span className="note-long">not the published seating</span><span className="note-short">not official</span></span> : <span />}
                <span aria-hidden className="room-corner" title="Front left, where seat 1 of row 1 is">
                  <CornerTopRight className={`h-3 w-3 ${MIRRORED ? '' : '-scale-x-100'}`} />
                  Front left
                </span>
              </div>
              <div className="room-board" aria-hidden>FRONT OF ROOM</div>
              <div role="grid" aria-label={`Seats in room ${roomName}, row 1 at the front`} className="room-grid" onKeyDown={onKey}>
                <div role="row" className="contents">
                  <span role="columnheader" aria-label="Row" />
                  {cols.map((n) => (
                    <span key={n} role="columnheader" aria-label={`Seat ${n}`} className="room-axis">{n}</span>
                  ))}
                  {fit.bothAxes && <span role="columnheader" aria-hidden />}
                </div>
                {Array.from({ length: dims.rows }, (_, r) => (
                  <div role="row" key={r} className="contents">
                    <span role="rowheader" aria-label={`Row ${r + 1}`} className="room-axis">{r + 1}</span>
                    {cols.map((col) => {
                      const s = cells.get(`${r + 1}:${col}`);
                      if (!s) return <span key={col} role="gridcell" aria-label="Empty" className="seat-gap" />;
                      return (
                        <span key={col} role="gridcell" className="relative">
                          {s.me && <span className="seat-pin">YOU</span>}
                          <button type="button" className="seat block" data-r={r + 1} data-c={col} tabIndex={s === firstFocus ? 0 : -1} title={`${s.label} · ${model.courseInfo[s.course]?.code ?? ''}`} {...seatProps(s)}>
                            {s.me && <span className="seat-ring" />}
                            {tag(s)}
                          </button>
                        </span>
                      );
                    })}
                    {fit.bothAxes && <span aria-hidden className="room-axis">{r + 1}</span>}
                  </div>
                ))}
              </div>
              <div className={`room-back ${MIRRORED ? 'flex-row' : 'flex-row-reverse'}`}>
                <span aria-hidden className="flex-1" />
                <p className="text-xs font-medium tracking-[0.2em] text-muted">BACK OF ROOM</p>
                <span aria-hidden className={`flex flex-1 ${MIRRORED ? 'justify-end' : 'justify-start'}`}>
                  <span className="room-corner" title="Back left, where seat 1 of the last row is">
                    <CornerBottomRight className={`h-3 w-3 ${MIRRORED ? '' : '-scale-x-100'}`} />
                    Back left
                  </span>
                </span>
              </div>
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
          {mine && (
            <p className="mt-3 flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
              <span aria-hidden className="mini-seat mini-seat-plain">
                <span className="seat-tag">{mine.tag}</span>
              </span>
              <span className="min-w-0 flex-1">
                Seats marked <b className="font-mono">{mine.tag}</b> are your section, <span className="font-mono">{mine.label}</span>
              </span>
              <span className="min-w-8 rounded-lg bg-surface px-2 py-0.5 text-center font-mono text-xs font-semibold text-ink-2">{mine.count}</span>
            </p>
          )}
          {spot && (
            <button type="button" onClick={() => setSpot(null)} className="btn btn-quiet btn-sm mt-2 w-full">Show all seats</button>
          )}
        </section>
      </aside>

      <SeatPopover
        seat={open}
        anchor={anchor}
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
