'use client';

/** Looks right and Report. Wired to the API in the confirmations phase; inert until then. */
export function SourceActions({ confirms, confirmed }: { slug: string; confirms: number; confirmed: boolean }) {
  const base = 'min-h-11 rounded border border-rule px-3 text-sm disabled:opacity-60';
  return (
    <div className="flex gap-2">
      <button type="button" disabled aria-pressed={confirmed} className={base} title="Coming soon">
        Looks right · <span className="font-mono">{confirms}</span>
      </button>
      <button type="button" disabled className={base} title="Coming soon">Report</button>
    </div>
  );
}
