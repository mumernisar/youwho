import { fail } from '@youwho/errors';
import { slotKey } from '../keys';
import type { RawPlan } from '../schema';
import type { Course, DecodedPlan, DecodedSeat, SeatPosition } from '../types';
import type { PlanDecoder } from './types';

const B = (s: string): number => parseInt(s, 36);

const CLASH_RE = /^CR-(\d+) (1st|2nd|3rd) (\d\d:\d\d)-(\d\d:\d\d)$/;
const EXTRA_RE = /^Extra-(\d+)$/;
const ORDERS = { '1st': 1, '2nd': 2, '3rd': 3 } as const;

/** Lenient: unknown labels are kept as plain text. */
export function parseSpecialLabel(label: string): SeatPosition {
  const clash = CLASH_RE.exec(label);
  if (clash) {
    return {
      kind: 'clash',
      label: `CR-${clash[1]}`,
      order: ORDERS[clash[2] as keyof typeof ORDERS],
      start: clash[3]!,
      end: clash[4]!,
    };
  }
  const extra = EXTRA_RE.exec(label);
  if (extra) return { kind: 'extra', n: Number(extra[1]) };
  return { kind: 'other', label };
}

function decodeSeatCode(raw: RawPlan, reg: string, home: number, code: string): DecodedSeat[] {
  const out: DecodedSeat[] = [];
  const bad = (offset: number, reason: string): never =>
    fail('DATA_DECODE_FAILED', { details: { reg, offset, reason } });
  const need = (i: number, n: number) => {
    if (i + n > code.length) bad(i, 'seat code ends mid-entry');
  };
  const inside = (i: number, value: number, length: number, what: string) => {
    if (!(value >= 0 && value < length)) bad(i, `${what} index ${value} is out of range`);
  };

  let i = 0;
  while (i < code.length) {
    const start = i;
    need(i, 4);
    const slot = B(code[i]!);
    const course = B(code.slice(i + 1, i + 3));
    const room = B(code[i + 3]!);
    inside(start, slot, raw.slots.length, 'slot');
    inside(start, course, raw.kinds.length, 'course');
    inside(start, room, raw.rooms.length, 'room');
    i += 4;

    need(i, 1);
    let position: SeatPosition;
    if (code[i] === '~') {
      need(i, 3);
      const idx = B(code.slice(i + 1, i + 3));
      inside(i, idx, raw.special.length, 'special seat');
      position = parseSpecialLabel(raw.special[idx]!);
      i += 3;
    } else {
      need(i, 2);
      const row = B(code[i]!);
      const col = B(code[i + 1]!);
      if (Number.isNaN(row) || Number.isNaN(col)) bad(i, 'seat is not row and column');
      position = { kind: 'grid', row, col };
      i += 2;
    }

    let section = home;
    if (code[i] === '.') {
      need(i, 3);
      section = B(code.slice(i + 1, i + 3));
      inside(i, section, raw.cls.length, 'section');
      i += 3;
    }
    out.push({ reg, slot, course, section, room, position });
  }
  return out;
}

export const decoderV1: PlanDecoder = {
  version: 'v1',
  logicHashes: ['3fc3416ed7a3fe6fc2e05c9096264fa7cd52df5b5e2c6e1d34defe7b14e7a0c4'],
  decode(raw: RawPlan): DecodedPlan {
    const warnings: string[] = [];
    const students: DecodedPlan['students'] = [];
    const seats: DecodedSeat[] = [];

    for (const [prefix, str] of Object.entries(raw.groups)) {
      if (str === '') continue;
      for (const row of str.split(';')) {
        const [roll, name, homeCode, seatCode] = row.split('|') as [string, string, string, string];
        const reg = `${prefix}-${roll}`;
        const home = B(homeCode);
        if (!(home >= 0 && home < raw.cls.length)) {
          fail('DATA_DECODE_FAILED', { details: { reg, offset: 0, reason: `home class index ${home} is out of range` } });
        }
        students.push({ reg, name, homeSection: home });
        for (const s of decodeSeatCode(raw, reg, home, seatCode)) seats.push(s);
      }
    }

    const roomDims: DecodedPlan['meta']['roomDims'] = {};
    for (const s of seats) {
      if (s.position.kind !== 'grid') continue;
      const d = (roomDims[s.room] ??= { rows: 0, cols: 0 });
      d.rows = Math.max(d.rows, s.position.row);
      d.cols = Math.max(d.cols, s.position.col);
    }

    const withSeats = new Set(seats.map((s) => s.reg)).size;
    if (raw.totals.students !== withSeats) {
      warnings.push(`totals.students is ${raw.totals.students} but ${withSeats} students have seats`);
    }
    if (raw.totals.seats !== seats.length) {
      warnings.push(`totals.seats is ${raw.totals.seats} but ${seats.length} seats were decoded`);
    }

    const tba: Record<string, Course[]> = {};
    for (const [reg, list] of Object.entries(raw.tba ?? {})) {
      tba[reg] = list.map(([code, title, teacher]) => ({ code, title, teacher: teacher || null }));
    }

    return {
      meta: {
        stamp: raw.stamp,
        slots: raw.slots.map(([date, start, end]) => ({ key: slotKey(date, start, end), date, start, end })),
        courses: raw.kinds.map(([code, title, teacher]) => ({ code, title, teacher: teacher || null })),
        sections: raw.cls,
        rooms: raw.rooms,
        roomDims,
        tba,
      },
      students,
      seats,
      warnings,
    };
  },
};
