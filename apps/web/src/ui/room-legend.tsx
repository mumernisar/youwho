'use client';

import type { ColourBy, LegendItem } from './room-model';
import { hueStyle } from './palette';

export function ColourToggle({ value, onChange }: { value: ColourBy; onChange: (v: ColourBy) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour seats by" className="inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-line">
      {(['course', 'section'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className="min-h-8 rounded-lg px-3 text-sm font-semibold text-muted capitalize transition aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** One row per course (or section). Tapping spotlights it on the map; tapping again clears. */
export function Legend({ items, spot, onSpot }: { items: LegendItem[]; spot: string | null; onSpot: (key: string | null) => void }) {
  return (
    <ul className="space-y-1" aria-label="Legend">
      {items.map((it) => (
        <li key={it.key}>
          <button
            type="button"
            aria-pressed={spot === it.key}
            onClick={() => onSpot(spot === it.key ? null : it.key)}
            style={hueStyle(it.hue)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2 aria-pressed:bg-surface-2 aria-pressed:ring-2 aria-pressed:ring-brand ${spot && spot !== it.key ? 'opacity-50' : ''}`}
          >
            <span className="mini-seat" data-tex={it.tex} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm leading-snug font-medium">{it.title}</span>
              {it.code && <span className="font-mono text-xs text-muted">{it.code}</span>}
            </span>
            {it.mine && <span className="you-chip">You</span>}
            <span className="min-w-8 rounded-lg bg-surface-2 px-2 py-0.5 text-center font-mono text-xs font-semibold text-ink-2">{it.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
