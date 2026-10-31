import type { RoomViewData } from '@/server/schemas';
import { seatText } from './format';

export interface CourseChip {
  idx: number;
  code: string;
  title: string;
  count: number;
  hue: number;
  tex: number;
  mine: boolean;
}

export interface SeatModel {
  reg: string;
  name: string;
  course: number;
  section: string;
  sectionDiffers: boolean;
  label: string;
  row: number;
  col: number;
  me: boolean;
}

export interface RoomModel {
  dims: { rows: number; cols: number };
  courses: CourseChip[];
  grid: SeatModel[];
  extras: SeatModel[];
  clash: SeatModel[];
  others: SeatModel[];
  myCourse: number | null;
}

/** Ten hues, spaced around the wheel. Theme lightness and chroma come from CSS variables. */
const HUES = [20, 55, 95, 140, 175, 205, 245, 285, 325, 355];
const TEXTURES = 4; // solid, dots, diagonal, cross-hatch

/** Build the render model: colours by seat count (largest first), own course takes the accent. */
export function buildRoomModel(data: RoomViewData, me: string | null): RoomModel {
  const counts = new Map<number, number>();
  const sections = new Map<number, Map<string, number>>();
  for (const s of data.seats) {
    counts.set(s.course, (counts.get(s.course) ?? 0) + 1);
    const m = sections.get(s.course) ?? new Map<string, number>();
    m.set(s.section, (m.get(s.section) ?? 0) + 1);
    sections.set(s.course, m);
  }
  const usual = new Map<number, string>();
  for (const [c, m] of sections) usual.set(c, [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0]);

  const mySeat = me ? data.seats.find((s) => s.reg === me) : undefined;
  const myCourse = mySeat?.course ?? null;

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  let rank = 0;
  const courses: CourseChip[] = ranked.map(([idx, n]) => {
    const mine = idx === myCourse;
    const r = mine ? 0 : rank++;
    return {
      idx,
      code: data.courses[idx]?.code ?? '',
      title: data.courses[idx]?.title ?? '',
      count: n,
      hue: HUES[r % HUES.length]!,
      tex: mine ? 0 : r % TEXTURES,
      mine,
    };
  });

  const model: RoomModel = { dims: data.dims, courses, grid: [], extras: [], clash: [], others: [], myCourse };
  for (const s of data.seats) {
    const base = {
      reg: s.reg,
      name: s.name,
      course: s.course,
      section: s.section,
      sectionDiffers: s.section !== usual.get(s.course),
      label: seatText(s.position),
      row: s.position.kind === 'grid' ? s.position.row : 0,
      col: s.position.kind === 'grid' ? s.position.col : 0,
      me: s.reg === me,
    };
    const target = { grid: model.grid, extra: model.extras, clash: model.clash, other: model.others }[s.position.kind];
    target.push(base);
  }
  model.extras.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  model.clash.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  return model;
}
