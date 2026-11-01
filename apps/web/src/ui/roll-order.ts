import { seatText } from './format';
import type { RoomModel, SeatModel } from './room-model';

/**
 * "Roll order" view: the room's students re-seated by roll number, as an invigilator might seat
 * them. Not the published plan. The room size is the grid the official plan uses.
 *
 * Rules:
 * 1. Each subject is sorted by roll number: year, then SP before FA, then program, then number.
 * 2. Seats fill downwards: row 1 to the back in a column, then the next column.
 * 3. Neighbouring columns get different subjects where the counts allow (A B A B; more rotate).
 *    The subject holding the smallest roll number takes column 1.
 * 4. With spare columns, one empty column goes between columns, first where two columns of the
 *    same subject would touch; spare columns left after that stay empty on the far side.
 * 5. In a nearly full room the column rules can run out of columns while seats are still free
 *    (each subject, however small, takes whole columns). Students left over then take the free
 *    seats, column by column from the front, in roll order. Only students beyond the room's seats
 *    become extra chairs.
 */

const ROLL_RE = /^(FA|SP)(\d{2})-([A-Z]+)-(\d+)$/i;

/** Sort key for "FA24-BSE-058". Numbers that do not match the pattern sort after, as text. */
function rollKey(reg: string): [number, string, number, string] {
  const m = ROLL_RE.exec(reg.trim());
  if (!m) return [Number.MAX_SAFE_INTEGER, '', 0, reg];
  const term = m[1]!.toUpperCase() === 'SP' ? 0 : 1;
  return [Number(m[2]) * 2 + term, m[3]!.toUpperCase(), Number(m[4]), ''];
}

export function compareRoll(a: string, b: string): number {
  const x = rollKey(a);
  const y = rollKey(b);
  return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2] - y[2] || x[3].localeCompare(y[3]);
}

/** Subject per column, avoiding two of the same side by side while any other subject has columns left. */
function columnSubjects(need: Map<number, number>, first: number): number[] {
  const left = new Map(need);
  const out: number[] = [];
  let prev: number | null = null;
  const total = [...need.values()].reduce((a, b) => a + b, 0);
  for (let i = 0; i < total; i++) {
    let pick: number | null = i === 0 && (left.get(first) ?? 0) > 0 ? first : null;
    if (pick === null) {
      // Most columns left first, so the big subject does not end up stacked at the back.
      const options = [...left.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
      pick = (options.find(([k]) => k !== prev) ?? options[0]!)[0];
    }
    out.push(pick);
    left.set(pick, left.get(pick)! - 1);
    prev = pick;
  }
  return out;
}

/** Room column for each subject column: one-column gaps where spare columns allow (rule 4). */
function placeColumns(subjects: number[], cols: number): number[] {
  const n = Math.min(subjects.length, cols);
  let spare = cols - n;
  const gapAfter = new Array<number>(Math.max(n - 1, 0)).fill(0);
  // Same subject side by side gets a gap first.
  for (let i = 0; i < gapAfter.length && spare > 0; i++) {
    if (subjects[i] === subjects[i + 1]) {
      gapAfter[i] = 1;
      spare--;
    }
  }
  // Then the rest, spread evenly over the remaining boundaries.
  const open = gapAfter.map((g, i) => (g ? -1 : i)).filter((i) => i >= 0);
  const take = Math.min(spare, open.length);
  for (let k = 0; k < take; k++) gapAfter[open[Math.floor(((k + 0.5) * open.length) / take)]!] = 1;
  const out: number[] = [];
  let col = 1;
  for (let i = 0; i < n; i++) {
    out.push(col);
    col += 1 + (gapAfter[i] ?? 0);
  }
  return out;
}

export function rollOrderModel(model: RoomModel): RoomModel {
  const { rows, cols } = model.dims;
  const pool = [...model.grid, ...model.extras];
  if (rows < 1 || cols < 1 || pool.length === 0) return model;

  const bySubject = new Map<number, SeatModel[]>();
  for (const s of pool) (bySubject.get(s.course) ?? bySubject.set(s.course, []).get(s.course)!).push(s);
  for (const list of bySubject.values()) list.sort((a, b) => compareRoll(a.reg, b.reg));

  const need = new Map([...bySubject].map(([k, list]) => [k, Math.ceil(list.length / rows)]));
  const smallest = [...pool].sort((a, b) => compareRoll(a.reg, b.reg))[0]!;
  const subjects = columnSubjects(need, smallest.course);
  const placed = placeColumns(subjects, cols);

  const grid: SeatModel[] = [];
  const next = new Map([...bySubject.keys()].map((k) => [k, 0]));
  placed.forEach((col, i) => {
    const k = subjects[i]!;
    const list = bySubject.get(k)!;
    for (let row = 1; row <= rows && next.get(k)! < list.length; row++) {
      const s = list[next.get(k)!]!;
      next.set(k, next.get(k)! + 1);
      grid.push({ ...s, row, col, label: seatText({ kind: 'grid', row, col }) });
    }
  });
  const leftover = [...bySubject].flatMap(([k, list]) => list.slice(next.get(k)!)).sort((a, b) => compareRoll(a.reg, b.reg));
  const taken = new Set(grid.map((s) => `${s.row}:${s.col}`));
  for (let col = 1; col <= cols && leftover.length > 0; col++) {
    for (let row = 1; row <= rows && leftover.length > 0; row++) {
      if (taken.has(`${row}:${col}`)) continue;
      const s = leftover.shift()!;
      grid.push({ ...s, row, col, label: seatText({ kind: 'grid', row, col }) });
    }
  }
  const overflow = leftover.map((s, i) => ({ ...s, row: 0, col: 0, label: seatText({ kind: 'extra', n: i + 1 }) }));

  const all = [...grid, ...overflow, ...model.clash, ...model.others];
  return { ...model, grid, extras: overflow, me: all.find((s) => s.me) ?? null };
}
