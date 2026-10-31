'use client';

import { useState } from 'react';

const THEMES = [
  { id: 'paper', label: 'Paper' },
  { id: 'chalkboard', label: 'Chalkboard' },
  { id: 'night', label: 'Night' },
] as const;

/** The server renders the cookie's theme into <html>, so there is no flash on load. */
export function ThemeSwitch({ initial }: { initial: string | null }) {
  const [theme, setTheme] = useState<string | null>(initial);
  const pick = (id: string) => {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    document.cookie = `yw_theme=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };
  return (
    <div role="group" aria-label="Theme" className="flex gap-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => pick(t.id)}
          aria-pressed={theme === t.id}
          className="min-h-6 rounded border border-rule px-2 py-0.5 text-xs text-muted aria-pressed:border-ink aria-pressed:text-ink hover:text-ink"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
