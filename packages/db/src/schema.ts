import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const datasets = pgTable('datasets', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  label: text('label').notNull(),
  sourceUrl: text('source_url').notNull().unique(),
  stamp: text('stamp').notNull(),
  meta: jsonb('meta').notNull(),
  dataHash: text('data_hash').notNull(),
  logicHash: text('logic_hash').notNull(),
  decoderKnown: boolean('decoder_known').notNull(),
  warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
  studentsCount: integer('students_count').notNull(),
  seatsCount: integer('seats_count').notNull(),
  confirmCount: integer('confirm_count').notNull().default(0),
  reportCount: integer('report_count').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const students = pgTable(
  'students',
  {
    datasetId: uuid('dataset_id').notNull().references(() => datasets.id, { onDelete: 'cascade' }),
    reg: text('reg').notNull(),
    name: text('name').notNull(),
    homeSection: smallint('home_section').notNull(),
  },
  (t) => [primaryKey({ columns: [t.datasetId, t.reg] }), index('students_reg_idx').on(t.reg)],
);

export const seats = pgTable(
  'seats',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    datasetId: uuid('dataset_id').notNull().references(() => datasets.id, { onDelete: 'cascade' }),
    reg: text('reg').notNull(),
    slotKey: text('slot_key').notNull(),
    // Slots sharing a start time may differ in end time, so each seat keeps its own.
    endTime: text('end_time').notNull(),
    course: smallint('course').notNull(),
    section: smallint('section').notNull(),
    room: text('room').notNull(),
    posKind: text('pos_kind').$type<'grid' | 'extra' | 'clash' | 'other'>().notNull(),
    row: smallint('row'),
    col: smallint('col'),
    label: text('label'),
  },
  (t) => [
    index('seats_room_idx').on(t.datasetId, t.slotKey, t.room),
    index('seats_reg_idx').on(t.reg),
  ],
);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceUrl: text('source_url').notNull(),
    kind: text('kind').$type<'add' | 'refresh'>().notNull(),
    datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'set null' }),
    status: text('status').$type<'queued' | 'running' | 'done' | 'failed'>().notNull().default('queued'),
    stage: text('stage').notNull().default('queued'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    requesterHash: text('requester_hash').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    startedAt: ts('started_at'),
    heartbeatAt: ts('heartbeat_at'),
    finishedAt: ts('finished_at'),
  },
  (t) => [
    uniqueIndex('jobs_active_url_idx')
      .on(t.sourceUrl)
      .where(sql`${t.status} in ('queued', 'running')`),
    index('jobs_status_created_idx').on(t.status, t.createdAt),
  ],
);

export const confirmations = pgTable(
  'confirmations',
  {
    datasetId: uuid('dataset_id').notNull().references(() => datasets.id, { onDelete: 'cascade' }),
    voterHash: text('voter_hash').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.datasetId, t.voterHash] })],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    datasetId: uuid('dataset_id').notNull().references(() => datasets.id, { onDelete: 'cascade' }),
    reason: text('reason').$type<'wrong_source' | 'outdated' | 'wrong_data' | 'other'>().notNull(),
    note: text('note'),
    voterHash: text('voter_hash').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('reports_dataset_idx').on(t.datasetId, t.createdAt)],
);

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: ts('window_start').notNull(),
    count: integer('count').notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const scraperStatus = pgTable('scraper_status', {
  id: smallint('id').primaryKey().default(1),
  lastSeenAt: ts('last_seen_at').notNull(),
});
