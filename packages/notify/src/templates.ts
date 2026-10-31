import type { OwnerEvent } from './events';

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const n = (v: number): string => v.toLocaleString('en');

interface Parts {
  subject: string;
  /** Plain lines: label, value. Values are user-derived, so html output escapes them. */
  lines: [string, string][];
  headline: string;
}

function parts(e: OwnerEvent): Parts {
  switch (e.type) {
    case 'dataset.added':
      return {
        subject: `New department: ${e.label}`,
        headline: `${e.label} was added`,
        lines: [
          ['Source', e.sourceUrl],
          ['Students', n(e.students)],
          ['Seats', n(e.seats)],
          ...(e.warnings.length ? ([['Warnings', e.warnings.join('; ')]] as [string, string][]) : []),
        ],
      };
    case 'dataset.updated':
      return {
        subject: `Updated: ${e.label}`,
        headline: `${e.label} was re-scraped and changed`,
        lines: [
          ['Source', e.sourceUrl],
          ['Seats', `${n(e.seatsBefore)} → ${n(e.seatsAfter)}`],
        ],
      };
    case 'dataset.reported':
      return {
        subject: `Report: ${e.label} (${e.reason})`,
        headline: `${e.label} was reported`,
        lines: [
          ['Reason', e.reason],
          ...(e.note ? ([['Note', e.note]] as [string, string][]) : []),
          ['Source', e.sourceUrl],
          ['Reports / looks right', `${e.reports} / ${e.confirms}`],
        ],
      };
    case 'decoder.unknown':
      return {
        subject: `Unknown page format: ${e.slug}`,
        headline: `${e.slug} uses a page script no decoder knows`,
        lines: [
          ['Source', e.sourceUrl],
          ['Script hash', e.logicHash],
          ['Decoder', 'The latest decoder was used. Check the data, then add a decoder for this format.'],
        ],
      };
  }
}

const adminLink = (siteUrl: string | undefined) => (siteUrl ? `${siteUrl.replace(/\/$/, '')}/admin` : '/admin');

/** Pure: event → subject, text and html. Every email links to /admin and to the source. */
export function render(e: OwnerEvent, siteUrl?: string): Rendered {
  const p = parts(e);
  const admin = adminLink(siteUrl);
  const text = [p.headline, '', ...p.lines.map(([k, v]) => `${k}: ${v}`), '', `Admin: ${admin}`].join('\n');
  const rows = p.lines.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px"><p><strong>${esc(p.headline)}</strong></p><table>${rows}</table><p><a href="${esc(admin)}">Open admin</a></p></div>`;
  return { subject: p.subject, text, html };
}

/** One email for everything held back by the hourly cap. */
export function renderDigest(events: OwnerEvent[], siteUrl?: string): Rendered {
  const items = events.map((e) => parts(e).headline);
  const admin = adminLink(siteUrl);
  const text = [`${events.length} events were held back by the hourly email limit:`, '', ...items.map((i) => `- ${i}`), '', `Admin: ${admin}`].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px"><p><strong>${events.length} events were held back by the hourly email limit</strong></p><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul><p><a href="${esc(admin)}">Open admin</a></p></div>`;
  return { subject: `youwho: ${events.length} more events`, text, html };
}
