'use client';

import { useState } from 'react';
import { THEMES, type ThemeId } from './themes';

/** Segmented picker. The server renders the cookie's theme into <html>, so there is no flash. */
export function ThemeSwitch({ initial }: { initial: ThemeId }) {
  const [theme, setTheme] = useState<ThemeId>(initial);
  const pick = (id: ThemeId) => {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    document.cookie = `yw_theme=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };
  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center gap-0.5 rounded-full bg-white/10 p-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          aria-label={`${t.label} theme`}
          title={t.label}
          onClick={() => pick(t.id)}
          className="flex min-h-8 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-head-ink/75 transition hover:text-head-ink aria-checked:bg-white/90 aria-checked:text-[#0e1a2b] sm:px-2.5"
        >
          <span aria-hidden className="h-3.5 w-3.5 rounded-full ring-1 ring-black/20" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
