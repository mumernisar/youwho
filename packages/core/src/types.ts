export type SlotKey = string; // "2026-11-03T14:30-15:50", stable across re-scrapes

export interface Slot {
  key: SlotKey;
  date: string;
  start: string;
  end: string;
}

export interface Course {
  code: string;
  title: string;
  teacher: string | null;
}

export type SeatPosition =
  | { kind: 'grid'; row: number; col: number } // row from front, col from the left as the source counts it, 1-based
  | { kind: 'extra'; n: number }
  | { kind: 'clash'; label: string; order: 1 | 2 | 3; start: string; end: string }
  | { kind: 'other'; label: string };

export interface DecodedSeat {
  reg: string;
  slot: number;
  course: number;
  section: number;
  room: number;
  position: SeatPosition;
}

export interface DecodedPlan {
  meta: {
    stamp: string;
    slots: Slot[];
    courses: Course[];
    sections: string[];
    rooms: string[];
    roomDims: Record<number, { rows: number; cols: number }>;
    tba: Record<string, Course[]>;
  };
  students: { reg: string; name: string; homeSection: number }[];
  seats: DecodedSeat[];
  warnings: string[];
}
