import { useId } from 'react';
import type { SpecialId } from './special-people';

/**
 * Seat effects for the owner, testers and stargazers: one drawing per person, in SVG, moved by CSS
 * (special.css) so `prefers-reduced-motion` stops them. Colours are the --fx-<id>-* tokens.
 *
 * Every effect has two layers on the same 100 x 100 canvas, with the seat in the middle (about 31 to
 * 69): a back layer that sits behind the seats (halo, rays, rings) and a front layer drawn over them
 * (emblem, sparks, orbit). `Emblem` draws both around a small chair for the banner and the credits.
 * All of it is decoration: aria-hidden, and a seat's accessible label names the role in words.
 */

type Layer = (p: { u: string }) => React.ReactElement;
type Css = Record<string, string | number>;

/** Unique id prefix: useId can contain characters that break url(#...). */
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, '');

const T = (dur: number, delay = 0, extra: Css = {}) => ({ '--dur': `${dur}s`, '--delay': `${delay}s`, ...extra }) as React.CSSProperties;
const rad = (d: number) => (d * Math.PI) / 180;
const f = (n: number) => Math.round(n * 100) / 100;
const pt = (r: number, deg: number, cx = 50, cy = 50): [number, number] => [f(cx + r * Math.cos(rad(deg))), f(cy + r * Math.sin(rad(deg)))];
const poly = (r: number, start: number, n: number, cx = 50, cy = 50) =>
  Array.from({ length: n }, (_, i) => `${i ? 'L' : 'M'}${pt(r, start + (360 / n) * i, cx, cy).join(' ')}`).join(' ') + ' Z';
const star = (cx: number, cy: number, R: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = rad(-90 + 36 * i);
    const rr = i % 2 ? r : R;
    return `${i ? 'L' : 'M'}${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  }).join(' ') + 'Z';
/** A four-point spark centred on 0,0. */
const SPARK = 'M0 -6 C.8 -1.6 1.6 -.8 6 0 C1.6 .8 .8 1.6 0 6 C-.8 1.6 -1.6 .8 -6 0 C-1.6 -.8 -.8 -1.6 0 -6Z';

const c = (id: SpecialId, k: string) => `var(--fx-${id}-${k})`;
const fill = (id: SpecialId, k: string, o?: number) => ({ fill: c(id, k), ...(o === undefined ? {} : { fillOpacity: o }) });
const stroke = (id: SpecialId, k: string) => ({ stroke: c(id, k) });
const stop = (id: SpecialId, k: string, o = 1) => ({ stopColor: c(id, k), stopOpacity: o });

/** The glow behind a seat. */
function Halo({ id, u, r = 48, a = 0.85 }: { id: SpecialId; u: string; r?: number; a?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={`${u}halo`}>
          <stop offset="0.3" style={stop(id, 'a', a)} />
          <stop offset="0.62" style={stop(id, 'a', a * 0.34)} />
          <stop offset="1" style={stop(id, 'a', 0)} />
        </radialGradient>
      </defs>
      <circle className="fx-breathe" cx="50" cy="50" r={r} fill={`url(#${u}halo)`} style={T(3.2)} />
    </>
  );
}

/**
 * An orbit like a planet's: an ellipse with the seat at one focus, walked at Kepler's pace (Kepler's
 * equation solved here), so it is fast where the path passes close to the seat and slow where it is far.
 * `tilt` turns the ellipse about the seat; `dir` is 1 for clockwise and -1 for the other way. `values` is
 * the position at equal steps of time, for animateMotion with calcMode="linear"; `path` is the same curve
 * for the dotted trace; `start` is the closest point to the seat.
 */
function orbit(a: number, e: number, tilt: number, dir: 1 | -1) {
  const b = a * Math.sqrt(1 - e * e);
  const cos = Math.cos(rad(tilt));
  const sin = Math.sin(rad(tilt));
  const at = (E: number): [number, number] => {
    const x = a * (Math.cos(E) - e);
    const y = dir * b * Math.sin(E);
    return [f(50 + x * cos - y * sin), f(50 + x * sin + y * cos)];
  };
  const steps = 72;
  const timed = Array.from({ length: steps + 1 }, (_, i) => {
    const M = (2 * Math.PI * i) / steps;
    let E = M;
    for (let k = 0; k < 24; k++) E = M + e * Math.sin(E);
    return at(E);
  });
  const shape = Array.from({ length: 64 }, (_, i) => at((2 * Math.PI * i) / 64));
  return {
    values: timed.map((q) => q.join(',')).join(';'),
    path: shape.map((q, i) => `${i ? 'L' : 'M'}${q.join(' ')}`).join(' ') + 'Z',
    start: timed[0]!,
  };
}
type Orbit = ReturnType<typeof orbit>;

/**
 * A comet on an orbit: a head and a tail of smaller dots, each started a little earlier than the next.
 * With reduced motion CSS hides the moving dots and shows one still dot on the curve.
 */
function Comet({ orb, dur, colors, ring, trace }: { orb: Orbit; dur: number; colors: string[]; ring: string; trace: string }) {
  const radii = [3.4, 2.7, 2.1, 1.6, 1.15];
  return (
    <g className="fx-orbit">
      <path d={orb.path} fill="none" style={{ stroke: trace }} strokeWidth=".7" strokeDasharray="1.2 3.2" strokeLinecap="round" opacity=".55" />
      <circle className="fx-orbit-still" cx={orb.start[0]} cy={orb.start[1]} r={radii[0]} style={{ fill: colors[0], stroke: ring }} strokeWidth=".9" />
      {[...radii].reverse().map((r, k) => {
        const i = radii.length - 1 - k;
        return (
          <circle key={i} className="fx-orbit-live" r={r} style={{ fill: colors[i] ?? colors[colors.length - 1], stroke: i === 0 ? ring : 'none' }} strokeWidth=".9" opacity={1 - i * 0.16}>
            <animateMotion dur={`${dur}s`} begin={`${-(radii.length - 1 - i) * 0.17}s`} repeatCount="indefinite" calcMode="linear" values={orb.values} />
          </circle>
        );
      })}
    </g>
  );
}

/** The two comets' orbits: the same shape, turned and run in opposite directions. */
const ORBIT_118 = orbit(33.5, 0.4, -30, 1);
const ORBIT_077 = orbit(33.5, 0.4, 150, -1);

/* ----------------------------------------------------------------------------------------------
 * 118 — the owner. A sunburst with two turning rings behind the seat; on it a crowned crest made of
 * the app's own mark (nine seats, the middle one lit), swept by light; a comet on an elliptical
 * orbit around the seat.
 * ------------------------------------------------------------------------------------------- */
const Back118: Layer = ({ u }) => {
  const id = '118';
  return (
    <>
      <defs>
        <linearGradient id={`${u}ray`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={stop(id, 'b', 0.95)} />
          <stop offset="1" style={stop(id, 'a', 0)} />
        </linearGradient>
        <linearGradient id={`${u}rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={stop(id, 'a')} />
          <stop offset="0.5" style={stop(id, 'b')} />
          <stop offset="1" style={stop(id, 'a')} />
        </linearGradient>
      </defs>
      <Halo id={id} u={u} />
      <g className="fx-spin" style={T(48)}>
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={i % 2 ? 'M50 50 L48.8 15 L51.2 15Z' : 'M50 50 L48.7 3 L51.3 3Z'} transform={`rotate(${i * 30} 50 50)`} fill={`url(#${u}ray)`} />
        ))}
      </g>
      <circle className="fx-spin fx-rev" cx="50" cy="50" r="45" fill="none" style={{ ...stroke(id, 'a'), ...T(60) }} strokeWidth="1.3" strokeDasharray="0.1 3.3" strokeLinecap="round" />
      <circle className="fx-spin" cx="50" cy="50" r="41.5" fill="none" style={{ ...stroke(id, 'b'), ...T(26) }} strokeWidth=".8" strokeDasharray="11 4 2 4" />
      <rect className="fx-breathe" x="29.4" y="29.4" width="41.2" height="41.2" rx="11.5" fill="none" stroke={`url(#${u}rim)`} strokeWidth="1.7" style={T(2.6)} />
    </>
  );
};

const Front118: Layer = ({ u }) => {
  const id = '118';
  const hex = poly(13.5, -90, 6, 50, 46);
  const cells = Array.from({ length: 9 }, (_, i) => ({ x: 43.7 + (i % 3) * 4.6, y: 39.7 + Math.floor(i / 3) * 4.6, mid: i === 4 }));
  return (
    <>
      <defs>
        <linearGradient id={`${u}fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stop(id, 'c', 0.96)} />
          <stop offset="1" style={{ stopColor: `color-mix(in oklab, ${c(id, 'c')} 70%, ${c(id, 'a')})`, stopOpacity: 0.96 }} />
        </linearGradient>
        <linearGradient id={`${u}edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={stop(id, 'b')} />
          <stop offset="1" style={stop(id, 'a')} />
        </linearGradient>
        <linearGradient id={`${u}shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={stop(id, 'b', 0)} />
          <stop offset="0.5" style={stop(id, 'b', 0.85)} />
          <stop offset="1" style={stop(id, 'b', 0)} />
        </linearGradient>
        <clipPath id={`${u}clip`}>
          <path d={hex} />
        </clipPath>
      </defs>
      <path d={hex} fill={`url(#${u}fill)`} stroke={`url(#${u}edge)`} strokeWidth="1.5" strokeLinejoin="round" />
      {cells.map((s, i) => (
        <rect key={i} className={s.mid ? 'fx-pulse' : 'fx-blink'} x={s.x} y={s.y} width="3.4" height="3.4" rx=".9" style={{ ...fill(id, s.mid ? 'a' : 'b'), ...T(s.mid ? 1.8 : 3.6, s.mid ? 0 : -i * 0.45) }} />
      ))}
      <g clipPath={`url(#${u}clip)`}>
        <rect className="fx-sweep" x="22" y="26" width="14" height="40" fill={`url(#${u}shine)`} style={T(3.6)} />
      </g>
      <path d="M41 32.6 L42.6 25.4 L46.4 29.6 L50 22.6 L53.6 29.6 L57.4 25.4 L59 32.6 Z" style={{ ...fill(id, 'b'), ...stroke(id, 'c') }} strokeWidth=".8" strokeLinejoin="round" />
      <circle cx="50" cy="23.4" r="1.4" style={fill(id, 'a')} />
      <g transform="translate(21 25) scale(.8)"><path className="fx-twinkle" d={SPARK} style={{ ...fill(id, 'b'), ...stroke(id, 'a'), ...T(2.4) }} strokeWidth=".6" /></g>
      <g transform="translate(81 32) scale(.6)"><path className="fx-twinkle" d={SPARK} style={{ ...fill(id, 'b'), ...stroke(id, 'a'), ...T(2.4, -0.8) }} strokeWidth=".6" /></g>
      <g transform="translate(17 72) scale(.55)"><path className="fx-twinkle" d={SPARK} style={{ ...fill(id, 'b'), ...stroke(id, 'a'), ...T(2.4, -1.6) }} strokeWidth=".6" /></g>
      <g transform="translate(85 76) scale(.8)"><path className="fx-twinkle" d={SPARK} style={{ ...fill(id, 'b'), ...stroke(id, 'a'), ...T(2.4, -0.4) }} strokeWidth=".6" /></g>
      <Comet
        orb={ORBIT_118}
        dur={9}
        colors={[c(id, 'b'), c(id, 'a'), c(id, 'a'), c(id, 'a'), c(id, 'a')]}
        ring={c(id, 'c')}
        trace={c(id, 'a')}
      />
    </>
  );
};

/* ----------------------------------------------------------------------------------------------
 * 077 — gold, crimson and black. Flames that never settle behind the seat, a marching two-colour
 * rim, embers rising, a spinning four-point spark on the cushion and a comet on an elliptical orbit
 * that runs the other way.
 * ------------------------------------------------------------------------------------------- */
const flame = (h: number, w: number) => `M0 0 C${-w} ${f(-h * 0.3)} ${f(-w * 0.9)} ${f(-h * 0.72)} 0 ${-h} C${f(w * 0.9)} ${f(-h * 0.72)} ${w} ${f(-h * 0.3)} 0 0Z`;
const FLAMES: [number, number, number, number, number][] = [
  // x, y, height, half width, lean (degrees)
  [35, 35, 21, 6.2, -16],
  [42.5, 33, 27, 6.8, -6],
  [50, 32, 33, 7.4, 0],
  [57.5, 33, 27, 6.8, 6],
  [65, 35, 21, 6.2, 16],
  [31, 47, 18, 5.6, -64],
  [69, 47, 18, 5.6, 64],
  [31, 59, 13, 4.8, -100],
  [69, 59, 13, 4.8, 100],
];
const Back077: Layer = ({ u }) => {
  const id = '077';
  return (
    <>
      <defs>
        <linearGradient id={`${u}out`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={stop(id, 'b')} />
          <stop offset="0.55" style={stop(id, 'b', 0.92)} />
          <stop offset="1" style={stop(id, 'c', 0.9)} />
        </linearGradient>
        <linearGradient id={`${u}in`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={stop(id, 'd')} />
          <stop offset="0.5" style={stop(id, 'a')} />
          <stop offset="1" style={stop(id, 'b', 0.8)} />
        </linearGradient>
        <radialGradient id={`${u}core`}>
          <stop offset="0.25" style={stop(id, 'a', 0.95)} />
          <stop offset="0.6" style={stop(id, 'b', 0.42)} />
          <stop offset="1" style={stop(id, 'b', 0)} />
        </radialGradient>
      </defs>
      <circle className="fx-flicker" cx="50" cy="50" r="49" fill={`url(#${u}core)`} style={T(1.7)} />
      {FLAMES.map(([x, y, h, w, lean], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${lean})`}>
          <path className="fx-flame" d={flame(h, w)} fill={`url(#${u}out)`} style={T(1.1 + (i % 4) * 0.23, -i * 0.31)} />
          <path className="fx-flame" d={flame(h * 0.62, w * 0.56)} fill={`url(#${u}in)`} style={T(0.8 + (i % 3) * 0.2, -i * 0.17)} />
        </g>
      ))}
      <rect x="29.2" y="29.2" width="41.6" height="41.6" rx="11.8" fill="none" style={stroke(id, 'c')} strokeWidth="3.4" />
      <rect className="fx-march" x="29.2" y="29.2" width="41.6" height="41.6" rx="11.8" fill="none" style={{ ...stroke(id, 'a'), ...T(2.2, 0, { '--len': '-19' }) }} strokeWidth="1.8" strokeDasharray="10 9" />
      <rect className="fx-march" x="29.2" y="29.2" width="41.6" height="41.6" rx="11.8" fill="none" style={{ ...stroke(id, 'b'), ...T(2.2, 0, { '--from': '-10', '--len': '-29' }) }} strokeWidth="1.8" strokeDasharray="5 14" />
      {[30, 38, 46, 54, 62, 70].map((x, i) => (
        <circle key={x} className="fx-rise" cx={x} cy="38" r={i % 2 ? 1.1 : 1.5} style={{ ...fill(id, i % 3 ? 'a' : 'd'), ...T(2.1 + (i % 3) * 0.6, -i * 0.55) }} />
      ))}
    </>
  );
};

const Front077: Layer = ({ u }) => {
  const id = '077';
  return (
    <>
      <defs>
        <linearGradient id={`${u}spark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stop(id, 'd')} />
          <stop offset="0.6" style={stop(id, 'a')} />
          <stop offset="1" style={stop(id, 'b')} />
        </linearGradient>
      </defs>
      <g className="fx-spark" style={T(5.5)}>
        <path d="M50 30 C51.8 40.6 55.4 44.2 66 46 C55.4 47.8 51.8 51.4 50 62 C48.2 51.4 44.6 47.8 34 46 C44.6 44.2 48.2 40.6 50 30Z" fill={`url(#${u}spark)`} style={stroke(id, 'c')} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M50 41 L54 46 L50 51 L46 46Z" style={fill(id, 'b')} />
      </g>
      <Comet
        orb={ORBIT_077}
        dur={8}
        colors={[c(id, 'd'), c(id, 'a'), c(id, 'b'), c(id, 'b'), c(id, 'c')]}
        ring={c(id, 'c')}
        trace={c(id, 'b')}
      />
    </>
  );
};

/* ----------------------------------------------------------------------------------------------
 * 073 — cobalt. A soft glow, two slow rings that spread out from the seat and a dotted ring turning
 * round it.
 * ------------------------------------------------------------------------------------------- */
const Back073: Layer = ({ u }) => {
  const id = '073';
  return (
    <>
      <Halo id={id} u={u} a={0.7} />
      {[0, -2.2].map((d) => (
        <rect key={d} className="fx-ripple" x="30" y="30" width="40" height="40" rx="11" fill="none" style={{ ...stroke(id, 'a'), ...T(4.4, d) }} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}
      <circle className="fx-spin" cx="50" cy="50" r="44" fill="none" style={{ ...stroke(id, 'a'), ...T(60) }} strokeWidth="1" strokeDasharray="1 3.4" strokeLinecap="round" opacity=".7" />
      <rect className="fx-breathe" x="29.4" y="29.4" width="41.2" height="41.2" rx="11.5" fill="none" style={{ ...stroke(id, 'a'), ...T(3.2) }} strokeWidth="1.5" />
    </>
  );
};

const Front073: Layer = () => <></>;

/* ----------------------------------------------------------------------------------------------
 * 092 — emerald. A hexagon ring with a pulse running round it, a second one the other way, and a node
 * on each corner that lights in turn.
 * ------------------------------------------------------------------------------------------- */
const Back092: Layer = ({ u }) => {
  const id = '092';
  const outer = poly(44, -90, 6);
  const inner = poly(36, -90, 6);
  return (
    <>
      <Halo id={id} u={u} a={0.82} />
      <path d={outer} style={{ ...stroke(id, 'a'), ...fill(id, 'a', 0.16) }} strokeWidth="1.8" strokeLinejoin="round" opacity=".85" />
      <path className="fx-march" d={outer} pathLength={100} fill="none" style={{ ...stroke(id, 'b'), ...T(3.4, 0, { '--len': '-100' }) }} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="14 86" />
      <path className="fx-spin" d={inner} fill="none" style={{ ...stroke(id, 'a'), ...T(40) }} strokeWidth="1" strokeDasharray="2 3.4" strokeLinejoin="round" />
      <path className="fx-march" d={inner} pathLength={100} fill="none" style={{ ...stroke(id, 'b'), ...T(4.6, -1, { '--len': '100' }) }} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 92" />
      <rect className="fx-breathe" x="29.4" y="29.4" width="41.2" height="41.2" rx="11.5" fill="none" style={{ ...stroke(id, 'a'), ...T(2.8) }} strokeWidth="1.6" />
    </>
  );
};

const Front092: Layer = () => {
  const id = '092';
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => {
        const [x, y] = pt(44, -90 + 60 * i);
        return <circle key={i} className="fx-node" cx={x} cy={y} r="2.7" style={{ ...fill(id, 'b'), ...stroke(id, 'c'), ...T(3.6, -i * 0.6) }} strokeWidth="1" />;
      })}
    </>
  );
};

/* ----------------------------------------------------------------------------------------------
 * 127 — rose. A soft glow, two dotted rings turning slowly in opposite directions and a few small
 * sparkles that open and close at different times.
 * ------------------------------------------------------------------------------------------- */
const Back127: Layer = ({ u }) => {
  const id = '127';
  return (
    <>
      <Halo id={id} u={u} a={0.7} />
      <circle className="fx-spin" cx="50" cy="50" r="44" fill="none" style={{ ...stroke(id, 'a'), ...T(50) }} strokeWidth="1.2" strokeDasharray="0.1 3.6" strokeLinecap="round" />
      <circle className="fx-spin fx-rev" cx="50" cy="50" r="38" fill="none" style={{ ...stroke(id, 'a'), ...T(70) }} strokeWidth=".8" strokeDasharray="5 5" opacity=".7" />
      <rect className="fx-breathe" x="29.4" y="29.4" width="41.2" height="41.2" rx="11.5" fill="none" style={{ ...stroke(id, 'a'), ...T(3) }} strokeWidth="1.5" />
    </>
  );
};

const Front127: Layer = () => {
  const id = '127';
  const sparks: [number, number, number, number][] = [
    [20, 26, 0.9, 0],
    [80, 24, 0.7, -0.9],
    [13, 66, 0.65, -1.8],
    [87, 70, 0.9, -1.3],
  ];
  return (
    <>
      {sparks.map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path className="fx-twinkle" d={SPARK} style={{ ...fill(id, 'b'), ...stroke(id, 'a'), ...T(3.2, d) }} strokeWidth=".6" />
        </g>
      ))}
    </>
  );
};

/* ----------------------------------------------------------------------------------------------
 * 085 — lavender. A constellation drawn and erased around the seat, a star on the cushion, and a
 * shooting star now and then.
 * ------------------------------------------------------------------------------------------- */
const STARS: [number, number][] = [
  [16, 38],
  [26, 14],
  [52, 6],
  [78, 16],
  [90, 40],
  [82, 74],
  [60, 92],
  [28, 86],
  [10, 64],
];
const Back085: Layer = ({ u }) => {
  const id = '085';
  const line = STARS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return (
    <>
      <Halo id={id} u={u} a={0.56} />
      <path className="fx-draw" d={line} pathLength={100} fill="none" style={{ ...stroke(id, 'a'), ...T(9) }} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" />
      {STARS.map(([x, y], i) => (
        <circle key={i} className="fx-twinkle" cx={x} cy={y} r={i % 3 === 0 ? 2.5 : 1.9} style={{ ...fill(id, 'b'), ...stroke(id, 'a'), ...T(2.8, -i * 0.43) }} strokeWidth=".8" />
      ))}
      <rect className="fx-breathe" x="29.4" y="29.4" width="41.2" height="41.2" rx="11.5" fill="none" style={{ ...stroke(id, 'a'), ...T(3) }} strokeWidth="1.5" />
    </>
  );
};

const Front085: Layer = ({ u }) => {
  const id = '085';
  return (
    <>
      <defs>
        <linearGradient id={`${u}tail`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={stop(id, 'a', 0)} />
          <stop offset="1" style={stop(id, 'b')} />
        </linearGradient>
      </defs>
      <g className="fx-wobble" style={T(4.4)}>
        <path d={star(50, 46, 14, 6)} style={{ ...fill(id, 'b'), ...stroke(id, 'a') }} strokeWidth="1.5" strokeLinejoin="round" />
        <path d={star(50, 46, 7, 3)} style={fill(id, 'a', 0.55)} />
      </g>
      <g className="fx-shoot" style={T(5.5)}>
        <path d="M6 24 L22 17" stroke={`url(#${u}tail)`} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </>
  );
};

const LAYERS: Record<SpecialId, { back: Layer; front: Layer }> = {
  '118': { back: Back118, front: Front118 },
  '077': { back: Back077, front: Front077 },
  '073': { back: Back073, front: Front073 },
  '092': { back: Back092, front: Front092 },
  '127': { back: Back127, front: Front127 },
  '085': { back: Back085, front: Front085 },
};

/**
 * One layer of a seat's effect, to sit in the seat's cell: `back` before the seat button, `front` after
 * it. `dim` fades it with the other seats while a course is spotlighted or a search found someone.
 */
export function SeatFx({ id, layer, dim = false }: { id: SpecialId; layer: 'back' | 'front'; dim?: boolean }) {
  const u = useUid();
  const L = LAYERS[id][layer];
  return (
    <svg className="seat-fx" data-layer={layer} data-fx={id} data-dim={dim} viewBox="0 0 100 100" aria-hidden focusable="false">
      <L u={u} />
    </svg>
  );
}

/** The effect on its own small chair: the banner's and the credits' picture of a person. */
export function Emblem({ id, className = '' }: { id: SpecialId; className?: string }) {
  const u = useUid();
  const { back: Back, front: Front } = LAYERS[id];
  return (
    <span className={`fx-badge ${className}`} data-fx={id} aria-hidden>
      <svg viewBox="0 0 100 100" focusable="false">
        <Back u={`${u}b`} />
        <rect x="31" y="31" width="38" height="29.5" rx="10" style={fill(id, 'a')} />
        <rect x="35" y="62.5" width="30" height="6.5" rx="3.2" style={fill(id, 'c')} />
        <Front u={`${u}f`} />
      </svg>
    </span>
  );
}
