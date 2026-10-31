export const THEMES = [
  { id: 'day', label: 'Day', swatch: ['#0b2a5c', '#eef2f8'] },
  { id: 'dusk', label: 'Dusk', swatch: ['#0a101c', '#5aa2ff'] },
  { id: 'sand', label: 'Sand', swatch: ['#2b2016', '#f4eee3'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

// Earlier theme names map onto the nearest current one.
const LEGACY: Record<string, ThemeId> = { paper: 'day', chalkboard: 'dusk', night: 'dusk' };

export function normalizeTheme(v: string | undefined): ThemeId | null {
  if (!v) return null;
  if (THEMES.some((t) => t.id === v)) return v as ThemeId;
  return LEGACY[v] ?? null;
}
