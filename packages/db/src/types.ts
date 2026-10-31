import type { Course, SeatPosition, Slot } from '@youwho/core';

export interface DatasetMeta {
  stamp: string;
  slots: Slot[];
  courses: Course[];
  sections: string[];
  rooms: string[];
  roomDims: Record<string, { rows: number; cols: number }>;
}

export interface Dataset {
  id: string;
  slug: string;
  label: string;
  sourceUrl: string;
  stamp: string;
  students: number;
  seats: number;
  confirms: number;
  reports: number;
  decoderKnown: boolean;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DatasetFull extends Dataset {
  meta: DatasetMeta & { tba: Record<string, Course[]> };
}

export interface Paper {
  slotKey: string;
  date: string;
  start: string;
  end: string;
  course: Course;
  room: string;
  roomSlug: string;
  position: SeatPosition;
  section: string | null; // only when not the home section
}

export interface LookupDepartment {
  dataset: Dataset;
  papers: Paper[];
  tba: Course[];
}

export interface LookupResult {
  reg: string;
  name: string;
  departments: LookupDepartment[];
}

export interface RoomSeat {
  position: SeatPosition;
  course: number;
  reg: string;
  name: string;
  section: string;
}

export interface RoomView {
  dataset: Dataset;
  room: string;
  slot: { key: string; date: string; start: string; end: string };
  dims: { rows: number; cols: number };
  courses: Course[]; // indexes match RoomSeat.course
  seats: RoomSeat[];
}

export interface RoomSummary {
  room: string;
  slug: string;
  slots: number;
}

export interface SaveResult {
  datasetId: string;
  slug: string;
  created: boolean;
  changed: boolean;
  seatsBefore: number;
}
