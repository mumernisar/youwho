import { z } from 'zod';
import type { Course, SeatPosition } from '@youwho/core';
import type { PublicError } from '@youwho/errors';

// ---- request schemas (shared with the client as types) ----
export const lookupQuery = z.object({ reg: z.string().min(1).max(40) });
export const slugParam = z.object({ slug: z.string().min(1).max(100) });
export const roomParams = z.object({
  slug: z.string().min(1).max(100),
  room: z.string().min(1).max(60),
  slotKey: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}-\d{2}:\d{2}$/),
});

export const jobBody = z.object({
  url: z.string().trim().min(1).max(500),
  kind: z.enum(['add', 'refresh']).optional(),
});
export const REPORT_REASONS = ['wrong_source', 'outdated', 'wrong_data', 'other'] as const;
export const reportBody = z.object({
  slug: z.string().min(1).max(100),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(500).optional(),
});
export const sessionBody = z.object({ token: z.string().min(1).max(200) });
export const deleteBody = z.object({ slugs: z.array(z.string().min(1).max(100)).min(1).max(50) });
export const idParam = z.object({ id: z.uuid() });

// ---- view types ----
export interface DatasetSummary {
  slug: string;
  label: string;
  sourceUrl: string;
  stamp: string;
  students: number;
  seats: number;
  confirms: number;
  reports: number;
  updatedAt: string;
  viewerConfirmed: boolean;
}

export interface PaperView {
  slotKey: string;
  date: string;
  start: string;
  end: string;
  course: Course;
  room: string;
  roomSlug: string;
  position: SeatPosition;
  section: string | null;
}

export interface LookupView {
  reg: string;
  name: string;
  departments: { dataset: DatasetSummary; papers: PaperView[]; tba: Course[] }[];
}

export interface RoomSeatView {
  position: SeatPosition;
  course: number;
  reg: string;
  name: string;
  section: string;
}

export interface RoomViewData {
  dataset: DatasetSummary;
  room: string;
  roomSlug: string;
  slot: { key: string; date: string; start: string; end: string };
  dims: { rows: number; cols: number };
  courses: Course[];
  seats: RoomSeatView[];
}

export interface DepartmentView {
  dataset: DatasetSummary;
  warnings: string[];
  rooms: { room: string; slug: string; slots: number; slotKeys: string[] }[];
}

export interface JobView {
  id: string;
  kind: 'add' | 'refresh';
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: string; // opening | extracting | checking | saving:<seats> | queued | done | failed
  position: number | null;
  waking: boolean;
  datasetSlug: string | null;
  error: PublicError | null;
  createdAt: string;
  elapsedSec: number;
}
