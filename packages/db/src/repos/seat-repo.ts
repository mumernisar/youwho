import { and, asc, eq, sql } from 'drizzle-orm';
import { fail } from '@youwho/errors';
import { parseSpecialLabel, roomSlug } from '@youwho/core';
import type { Db } from '../client.js';
import { guard } from '../translate.js';
import { datasets, seats, students } from '../schema.js';
import type { LookupResult, Paper, RoomSeat, RoomSummary, RoomView } from '../types.js';
import { colsToPosition, toDataset, toDatasetFull } from './mappers.js';

export class SeatRepo {
  constructor(private readonly db: Db) {}

  /** Every dataset that knows this student, with papers sorted by date and time. Null when none does. */
  lookup(reg: string): Promise<LookupResult | null> {
    return guard(async () => {
      const found = await this.db
        .select({ student: students, dataset: datasets })
        .from(students)
        .innerJoin(datasets, eq(datasets.id, students.datasetId))
        .where(eq(students.reg, reg))
        .orderBy(asc(datasets.createdAt));
      if (found.length === 0) return null;

      const seatRows = await this.db.select().from(seats).where(eq(seats.reg, reg));
      const departments = found.map(({ student, dataset }) => {
        const full = toDatasetFull(dataset);
        const papers: Paper[] = seatRows
          .filter((s) => s.datasetId === dataset.id)
          .map((s) => {
            const slot = full.meta.slots.find((x) => x.key === s.slotKey);
            return {
              slotKey: s.slotKey,
              date: slot?.date ?? s.slotKey.slice(0, 10),
              start: slot?.start ?? s.slotKey.slice(11),
              end: s.endTime,
              course: full.meta.courses[s.course]!,
              room: s.room,
              roomSlug: roomSlug(s.room),
              position: colsToPosition(s, parseSpecialLabel),
              section: s.section === student.homeSection ? null : (full.meta.sections[s.section] ?? null),
            };
          })
          .sort((a, b) => (a.slotKey + a.end).localeCompare(b.slotKey + b.end));
        return { dataset: toDataset(dataset), papers, tba: full.meta.tba[reg] ?? [] };
      });
      return { reg, name: found[0]!.student.name, departments };
    });
  }

  /** One query for the seats of a room in a slot, joined with names. */
  roomView(opts: { datasetSlug: string; roomSlug: string; slotKey: string }): Promise<RoomView> {
    return guard(async () => {
      const [row] = await this.db.select().from(datasets).where(eq(datasets.slug, opts.datasetSlug)).limit(1);
      if (!row) return fail('DATASET_NOT_FOUND', { details: { slug: opts.datasetSlug } });
      const full = toDatasetFull(row);
      const room = full.meta.rooms.find((r) => roomSlug(r) === opts.roomSlug);
      if (!room) return fail('ROOM_SLOT_NOT_FOUND');

      const rows = await this.db
        .select({ s: seats, name: students.name })
        .from(seats)
        .innerJoin(students, and(eq(students.datasetId, seats.datasetId), eq(students.reg, seats.reg)))
        .where(and(eq(seats.datasetId, row.id), eq(seats.slotKey, opts.slotKey), eq(seats.room, room)));
      if (rows.length === 0) return fail('ROOM_SLOT_NOT_FOUND');

      const roomSeats: RoomSeat[] = rows.map(({ s, name }) => ({
        position: colsToPosition(s, parseSpecialLabel),
        course: s.course,
        reg: s.reg,
        name,
        section: full.meta.sections[s.section] ?? '',
      }));
      const slot = full.meta.slots.find((x) => x.key === opts.slotKey)!;
      const end = rows.map((r) => r.s.endTime).sort().at(-1) ?? slot.end;
      return {
        dataset: toDataset(row),
        room,
        slot: { key: slot.key, date: slot.date, start: slot.start, end },
        dims: (full.meta.roomDims as Record<string, { rows: number; cols: number }>)[room] ?? { rows: 0, cols: 0 },
        courses: full.meta.courses,
        seats: roomSeats,
      };
    });
  }

  /** Rooms of a dataset and how many slots use each. */
  rooms(datasetId: string): Promise<RoomSummary[]> {
    return guard(async () => {
      const rows = await this.db
        .select({ room: seats.room, slots: sql<number>`count(distinct ${seats.slotKey})::int` })
        .from(seats)
        .where(eq(seats.datasetId, datasetId))
        .groupBy(seats.room)
        .orderBy(asc(seats.room));
      return rows.map((r) => ({ room: r.room, slug: roomSlug(r.room), slots: r.slots }));
    });
  }

  /** Slots a room is used in, in time order. */
  roomSlots(datasetId: string, room: string): Promise<{ slotKey: string; seats: number }[]> {
    return guard(async () => {
      const rows = await this.db
        .select({ slotKey: seats.slotKey, seats: sql<number>`count(*)::int` })
        .from(seats)
        .where(and(eq(seats.datasetId, datasetId), eq(seats.room, room)))
        .groupBy(seats.slotKey)
        .orderBy(asc(seats.slotKey));
      return rows;
    });
  }
}
