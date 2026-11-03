import type { SearchStats } from '@/server/schemas';
import { count } from './format';

export function AdminSearches({ stats }: { stats: SearchStats }) {
  const totals = [
    { label: 'Today', value: stats.today },
    { label: 'Last 7 days', value: stats.week },
    { label: 'All time', value: stats.total },
  ];
  return (
    <section aria-labelledby="searches" className="mt-12">
      <h2 id="searches" className="text-lg font-semibold">Searches</h2>
      <p className="mt-1 text-sm text-muted">Registration number searches from the home page. Days are Pakistan time.</p>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {totals.map((t) => (
          <div key={t.label} className="card p-4">
            <dt className="text-xs text-muted">{t.label}</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold">{count(t.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-rule text-muted">
            <tr>
              <th className="py-2">Intake</th><th>Programme</th><th className="text-right">Found</th><th className="text-right">Not found</th><th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {stats.cohorts.length === 0 && <tr><td colSpan={5} className="py-6 text-muted">No searches yet.</td></tr>}
            {stats.cohorts.map((c) => (
              <tr key={`${c.intake}-${c.programme}`}>
                <td className="py-2 font-mono">{c.intake}</td>
                <td className="font-mono">{c.programme}</td>
                <td className="text-right font-mono">{count(c.found)}</td>
                <td className="text-right font-mono">{count(c.notFound)}</td>
                <td className="text-right font-mono font-semibold">{count(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stats.invalid > 0 && (
        <p className="mt-3 text-sm text-muted">{count(stats.invalid)} searches were not a registration number.</p>
      )}
    </section>
  );
}
