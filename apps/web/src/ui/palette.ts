/**
 * Categorical hues (OKLCH hue angles), spaced around the wheel. Yellow-amber (about 70–110) is left
 * out on purpose: amber means "you" everywhere. Lightness and chroma come from the theme, so these
 * only pick the hue.
 */
export const HUES = [262, 200, 150, 22, 320, 232, 175, 352, 290, 125, 45, 215] as const;

/** Small stable string hash, so a course or section gets the same hue on every page. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const hueFor = (key: string): number => HUES[hash(key) % HUES.length]!;

/**
 * Hues in order of how far apart they sit, so the biggest groups in a room get the most
 * distinguishable colours: blue, green, red, teal, magenta, violet, orange, sea green, azure, pink, lime.
 */
const DISTINCT = [262, 145, 22, 200, 325, 292, 48, 172, 232, 352, 122] as const;

/** Colours for groups in one view, largest first. Past the palette, hues repeat with a texture. */
export function assignHues(keys: string[]): Map<string, { hue: number; tex: number }> {
  const out = new Map<string, { hue: number; tex: number }>();
  keys.forEach((key, i) => {
    out.set(key, { hue: DISTINCT[i % DISTINCT.length]!, tex: Math.floor(i / DISTINCT.length) % 4 });
  });
  return out;
}

/** One hue per exam day, in calendar order, so a week reads as a sequence. */
const DAY_HUES = [262, 200, 150, 320, 22, 232, 175] as const;
export const dayHue = (date: string): number => DAY_HUES[new Date(`${date}T12:00:00Z`).getUTCDay()]!;

export const hueStyle = (h: number) => ({ '--h': h }) as React.CSSProperties;

export const initials = (s: string): string =>
  s
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
