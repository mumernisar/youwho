const TZ = 'Asia/Karachi';

/** "Tue 3 Nov". Dates arrive as YYYY-MM-DD in local exam time, so format them as plain calendar dates. */
export function fmtDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(',', '');
}

export function fmtDateLong(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

/** "2:30 PM" from "14:30". */
export function fmtTime(t: string): string {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const fmtRange = (start: string, end: string): string => `${fmtTime(start)} – ${fmtTime(end)}`;

/** "31 Oct" for an instant, in Karachi time. */
export function fmtUpdated(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));
}

export const sourceHost = (url: string): string => url.replace(/^https?:\/\//, '');

export const count = (n: number): string => n.toLocaleString('en');

/** Type-as-you-go formatting: "fa24bse58" → "FA24-BSE-58". */
export function formatRegInput(v: string): string {
  const x = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const parts = [x.slice(0, 4), x.slice(4, 7), x.slice(7, 10)].filter(Boolean);
  return parts.join('-');
}

export type SeatPositionView =
  | { kind: 'grid'; row: number; col: number }
  | { kind: 'extra'; n: number }
  | { kind: 'clash'; label: string; order: 1 | 2 | 3; start: string; end: string }
  | { kind: 'other'; label: string };

const ORD = { 1: '1st', 2: '2nd', 3: '3rd' } as const;

export function seatText(p: SeatPositionView): string {
  switch (p.kind) {
    case 'grid':
      return `Row ${p.row}, seat ${p.col}`;
    case 'extra':
      return `Extra chair ${p.n}`;
    case 'clash':
      return `${p.label}, ${ORD[p.order]} sitting`;
    case 'other':
      return p.label;
  }
}
