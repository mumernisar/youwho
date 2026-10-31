import type { RoomViewData } from '@/server/schemas';
import { seatText } from './format';
import { assignHues } from './palette';

export type ColourBy = 'course' | 'section';

export interface LegendItem {
  key: string; // "c<idx>" for a course, the section label for a section
  title: string;
  code: string | null;
  count: number;
  hue: number;
  tex: number;
  mine: boolean;
}

export interface SeatModel {
  id: string;
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
  courses: LegendItem[];
  sections: LegendItem[];
  courseInfo: { code: string; title: string }[];
  grid: SeatModel[];
  extras: SeatModel[];
  clash: SeatModel[];
  others: SeatModel[];
  me: SeatModel | null;
}

const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;

/** Render model: course and section colours (largest group first, stable hues), seats split by kind. */
export function buildRoomModel(data: RoomViewData, me: string | null): RoomModel {
  const courseCount = new Map<number, number>();
  const sectionCount = new Map<string, number>();
  const sectionsOfCourse = new Map<number, Map<string, number>>();
  for (const s of data.seats) {
    courseCount.set(s.course, (courseCount.get(s.course) ?? 0) + 1);
    sectionCount.set(s.section, (sectionCount.get(s.section) ?? 0) + 1);
    const m = sectionsOfCourse.get(s.course) ?? new Map<string, number>();
    m.set(s.section, (m.get(s.section) ?? 0) + 1);
    sectionsOfCourse.set(s.course, m);
  }
  const usual = new Map<number, string>();
  for (const [c, m] of sectionsOfCourse) usual.set(c, [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0]);

  const mySeat = me ? data.seats.find((s) => s.reg === me) : undefined;
  const code = (i: number) => data.courses[i]?.code ?? '';

  const courseList = [...courseCount.entries()].map(([idx, count]) => ({ idx, count })).sort(byCount);
  // Keyed by index: two different courses can share a code.
  const courseHues = assignHues(courseList.map((c) => `c${c.idx}`));
  const courses: LegendItem[] = courseList.map(({ idx, count }) => ({
    key: `c${idx}`,
    title: data.courses[idx]?.title ?? code(idx),
    code: code(idx),
    count,
    ...courseHues.get(`c${idx}`)!,
    mine: idx === mySeat?.course,
  }));

  const sectionList = [...sectionCount.entries()].map(([label, count]) => ({ label, count })).sort(byCount);
  const sectionHues = assignHues(sectionList.map((s) => `section:${s.label}`));
  const sections: LegendItem[] = sectionList.map(({ label, count }) => ({
    key: label,
    title: label === '—' || label === '' ? 'No section' : label,
    code: null,
    count,
    ...sectionHues.get(`section:${label}`)!,
    mine: label === mySeat?.section,
  }));

  const model: RoomModel = {
    dims: data.dims,
    courses,
    sections,
    courseInfo: data.courses.map((c) => ({ code: c.code, title: c.title })),
    grid: [],
    extras: [],
    clash: [],
    others: [],
    me: null,
  };
  data.seats.forEach((s, i) => {
    const seat: SeatModel = {
      id: `s${i}`,
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
    if (seat.me) model.me = seat;
    ({ grid: model.grid, extra: model.extras, clash: model.clash, other: model.others })[s.position.kind].push(seat);
  });
  const natural = (a: SeatModel, b: SeatModel) => a.label.localeCompare(b.label, 'en', { numeric: true });
  model.extras.sort(natural);
  model.clash.sort(natural);
  return model;
}

/** "2 seats to your right, 1 row behind you". Row 1 is the front; seats count from the left. */
export function relativeTo(me: SeatModel, s: SeatModel): string | null {
  if (!me.row || !s.row || me.id === s.id) return null;
  const dx = s.col - me.col;
  const dy = s.row - me.row;
  if (Math.abs(dx) === 1 && dy === 0) return `Right next to you, on your ${dx > 0 ? 'right' : 'left'}`;
  if (dx === 0 && Math.abs(dy) === 1) return dy < 0 ? 'Directly in front of you' : 'Directly behind you';
  const parts: string[] = [];
  if (dx) parts.push(`${Math.abs(dx)} ${Math.abs(dx) === 1 ? 'seat' : 'seats'} to your ${dx > 0 ? 'right' : 'left'}`);
  if (dy) parts.push(`${Math.abs(dy)} ${Math.abs(dy) === 1 ? 'row' : 'rows'} ${dy < 0 ? 'in front of you' : 'behind you'}`);
  if (!dy) parts.push('same row');
  return parts.join(', ');
}
