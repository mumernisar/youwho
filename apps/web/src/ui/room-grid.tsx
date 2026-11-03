'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MIRRORED, type ColourBy, type LegendItem, type RoomModel, type SeatModel } from './room-model';
import { ColourToggle, Legend } from './room-legend';
import { SeatPopover } from './seat-popover';
import { rollOrderModel } from './roll-order';
import { formatRegInput } from './format';
import { hueStyle } from './palette';
import { Alert, Check, CornerBottomRight, CornerTopRight, Minus, Plus, Search, X } from './icons';

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
/** The seat for a roll number, or for its end when only one seat ends that way. `many`: more than one does. */
function findSeat(seats: SeatModel[], query: string): { seat: SeatModel | null; many: boolean } {
  const q = normReg(query);
  if (!q) return { seat: null, many: false };
  const exact = seats.find((s) => normReg(s.reg) === q);
  if (exact) return { seat: exact, many: false };
  const tail = seats.filter((s) => normReg(s.reg).endsWith(q));
  return tail.length === 1 ? { seat: tail[0]!, many: false } : { seat: null, many: tail.length > 1 };
}

interface Fit {
  seat: number;
  axis: number;
  bothAxes: boolean;
}

/** A whole roll number once punctuation is gone, e.g. FA23BSE127: searched without pressing Enter. */
const FULL_REG = /^[A-Z]{2}\d{2}[A-Z]{3}\d{3}$/;
/** Pause after the last keystroke before a whole roll number is searched. */
const AUTO_FIND_MS = 250;
/** Length of the search's open and close animation (find-grow / find-shrink in globals.css). */
const FIND_ANIM_MS = 160;

/** Card content width (px) at which the header's controls move right: Tailwind's @2xl, 42rem. */
const WIDE_CARD = 672;

type FindResult = 'idle' | 'found' | 'missed' | 'many';
const FIND_LABEL: Record<FindResult, string> = { idle: 'Find', found: 'Found', missed: 'Not found', many: 'Type more' };

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
  const [many, setMany] = useState(false);
  /** Bumped by every search, so Enter or Find on the same number scrolls to the seat again. */
  const [findTick, setFindTick] = useState(0);
  const findInput = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLElement>(null);
  // Matches the header's @2xl container query: a wide card puts the controls on the right, and the search opens inline.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWide((entry?.contentRect.width ?? 0) >= WIDE_CARD));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Zoom is a wide-card control; a narrow card always shows the room fitted to it.
  const seatPx = fit.seat * (wide ? ZOOMS[zoom]! : 1);
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
  }, [found, findTick, reveal]);
  const runFind = useCallback(
    (q: string) => {
      if (!normReg(q)) return;
      const hit = findSeat(allSeats, q);
      setFound(hit.seat);
      setFindTick((t) => t + 1);
      setMany(hit.many);
      setMissed(hit.seat ? null : q.trim().toUpperCase());
    },
    [allSeats],
  );
  const onFind = (e: React.FormEvent) => {
    e.preventDefault();
    runFind(query);
  };
  // A whole roll number is searched once typing pauses; a partial one (the end of a number) waits for Enter.
  useEffect(() => {
    if (!FULL_REG.test(normReg(query))) return;
    const t = setTimeout(() => runFind(query), AUTO_FIND_MS);
    return () => clearTimeout(t);
  }, [query, runFind]);
  // Closing plays the opening animation backwards, then removes the search.
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (closeTimer.current && clearTimeout(closeTimer.current)), []);
  const closeFind = () => {
    const finish = () => {
      setFindOpen(false);
      setClosing(false);
      setQuery('');
      setFound(null);
      setMissed(null);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();
    setClosing(true);
    closeTimer.current = setTimeout(finish, FIND_ANIM_MS);
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
  const openFind = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    setFindOpen(true);
    requestAnimationFrame(() => findInput.current?.focus());
  };
  const findField = (className: string) => (
    <>
      <label htmlFor="find-roll" className="sr-only">Roll number</label>
      <input
        ref={findInput}
        id="find-roll"
        value={query}
        onChange={(e) => {
          setQuery(formatRegInput(e.target.value));
          setFound(null);
          setMissed(null);
        }}
        onKeyDown={(e) => e.key === 'Escape' && closeFind()}
        placeholder="FA23-BSE-077"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="search"
        className={className}
      />
    </>
  );
  /** The search's Find button carries the result: Found (green), Not found or Type more (red). */
  const result: FindResult = found ? 'found' : missed ? (many ? 'many' : 'missed') : 'idle';
  // A wider result button leaves the field less room, so it shows the end of the number, the part that was matched.
  useEffect(() => {
    const el = findInput.current;
    if (el && result !== 'idle') el.scrollLeft = el.scrollWidth;
  }, [result]);
  const findLabel = (
    <>
      {result === 'found' ? <Check className="h-4 w-4" /> : result === 'idle' ? <Search className="h-4 w-4" /> : <Alert className="h-4 w-4" />}
      {FIND_LABEL[result]}
    </>
  );
  /** Read out by screen readers, since the result is otherwise shown only by the button and the seat. */
  const findStatus = (
    <span aria-live="polite" className="sr-only">
      {found ? `Found ${found.name}, ${found.label}` : missed ? (many ? `More than one seat ends in ${missed}. Type more of the number.` : `${missed} is not in this room`) : ''}
    </span>
  );
  /** In the map, an open search takes the whole row above the front board. */
  /**
   * Wide card: Find is the frame of an expanding search. Pressed, the frame grows to the left around
   * the field, and Find stays inside it at the right end as the submit button.
   */
  const findMorph = (
    <div className="relative min-w-0">
      <form id="find-seat" role="search" onSubmit={onFind} className="find-morph" data-open={findOpen} data-closing={closing}>
        {findOpen && (
          <>
            {findField('find-morph-input')}
            <button type="button" onClick={closeFind} aria-label="Close search" className="find-morph-close btn btn-quiet btn-icon h-7 min-h-7 w-7 flex-none rounded-lg">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          type={findOpen ? 'submit' : 'button'}
          onClick={findOpen ? undefined : openFind}
          aria-expanded={findOpen}
          aria-controls="find-seat"
          className="find-morph-go"
          data-result={result}
        >
          {findLabel}
        </button>
      </form>
      {findOpen && findStatus}
    </div>
  );
  /** Narrow card: Find sits at the right end of the view switch and opens the search row under it; pressed again, or Escape, closes it. */
  const findToggle = (
    <button type="button" aria-expanded={findOpen} aria-controls="find-seat" onClick={() => (findOpen ? closeFind() : openFind())} className="find-toggle btn btn-secondary btn-sm flex-none">
      <Search className="h-4 w-4" />
      Find
    </button>
  );
  const zoomControl = grid.length > 0 && (
    <div className="flex flex-none items-center rounded-xl ring-1 ring-line">
      <button type="button" aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)} className="btn btn-quiet btn-sm btn-icon h-9 min-h-9 w-9 rounded-r-none"><Minus className="h-4 w-4" /></button>
      <span className="w-11 text-center font-mono text-xs text-muted">{Math.round(ZOOMS[zoom]! * 100)}%</span>
      <button type="button" aria-label="Zoom in" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => z + 1)} className="btn btn-quiet btn-sm btn-icon h-9 min-h-9 w-9 rounded-l-none"><Plus className="h-4 w-4" /></button>
    </div>
  );
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
        <button type="button" {...seatProps(s)} className={`flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-brand data-[found=true]:border-success data-[found=true]:ring-2 data-[found=true]:ring-success ${spot !== null && keyOf(s) !== spot ? 'opacity-30' : ''}`}>
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
      data-finding={found !== null}
      {...(spot !== null ? { 'data-spot': spot } : {})}
    >
      {aside && <div className="lg:hidden">{aside}</div>}
      {/* Laid out by the card's own width, not the screen's: beside the legend on a tablet it is narrow. */}
      <section ref={card} className="card @container min-w-0 p-2 sm:p-4" aria-label="Seating plan">
        {/* Narrow card: switch with Find at its right end, then the note; the search row opens under them.
            There is no zoom control: the room is fitted to the card and pinch-zoom still works.
            Wide card: switch and controls share the top row and the note gets its own row, so the search
            can open inline beside Find using the row's free space without squeezing the switch. */}
        <div className="grid grid-cols-1 gap-2 px-1 pb-3 @2xl:grid-cols-[auto_minmax(0,1fr)] @2xl:items-center">
          <div className="flex min-w-0 items-center justify-between gap-2 whitespace-nowrap">
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
            {!wide && findToggle}
          </div>
          {grid.length > 0 && (
            <p className="-mt-0.5 text-xs text-muted @2xl:col-span-2 @2xl:row-start-2">
              {MIRRORED ? 'Left and right as the invigilator at the front sees it. Seat 1 is on your right.' : 'Seat 1 is on your left as you face the front.'}
            </p>
          )}
          {wide && (
            <div className="flex min-w-0 items-center gap-2 @2xl:col-start-2 @2xl:row-start-1 @2xl:justify-end">
              {findMorph}
              {zoomControl}
            </div>
          )}
        </div>

        {/* The row unfolds from zero height, so the map slides down instead of jumping, and folds away on close. */}
        {findOpen && !wide && (
          <div className="find-row" data-closing={closing}>
            <form id="find-seat" role="search" onSubmit={onFind} className="find-row-body relative max-w-md px-1 pt-1 pb-4">
              <div className="flex gap-2">
                {findField('field min-h-10 min-w-0 flex-1 font-mono text-sm')}
                <button type="submit" className="find-go btn btn-primary btn-sm min-h-10 flex-none" data-result={result}>{findLabel}</button>
              </div>
              {findStatus}
            </form>
          </div>
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
