export const THEMES = [
  { id: 'day', label: 'Day', swatch: ['#0b2a5c', '#eef2f8'] },
  { id: 'dusk', label: 'Dusk', swatch: ['#0a101c', '#5aa2ff'] },
  { id: 'sand', label: 'Sand', swatch: ['#2b2016', '#f4eee3'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'sand';

// Earlier theme names map onto the nearest current one.
const LEGACY: Record<string, ThemeId> = { paper: 'day', chalkboard: 'dusk', night: 'dusk' };

/** The cookie's theme; no cookie or an unknown value gets the default. */
export function normalizeTheme(v: string | undefined): ThemeId {
  if (!v) return DEFAULT_THEME;
  if (THEMES.some((t) => t.id === v)) return v as ThemeId;
  return LEGACY[v] ?? DEFAULT_THEME;
}
