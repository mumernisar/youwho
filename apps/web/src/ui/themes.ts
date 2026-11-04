export const THEMES = [
  { id: 'sand', label: 'Sand', swatch: ['#2b2016', '#f4eee3'] },
  { id: 'dusk', label: 'Dusk', swatch: ['#141210', '#ee8457'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'sand';

// Earlier theme names map onto the nearest current one. Day (the old blue light theme) became Sand.
const LEGACY: Record<string, ThemeId> = { day: 'sand', paper: 'sand', chalkboard: 'dusk', night: 'dusk' };

/** The cookie's theme; no cookie or an unknown value gets the default. */
export function normalizeTheme(v: string | undefined): ThemeId {
  if (!v) return DEFAULT_THEME;
  if (THEMES.some((t) => t.id === v)) return v as ThemeId;
  return LEGACY[v] ?? DEFAULT_THEME;
}
