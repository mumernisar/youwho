import type { SeatPosition } from '@youwho/core';
import type { datasets, seats } from '../schema.js';
import type { Dataset, DatasetFull, DatasetMeta } from '../types.js';
import type { Course } from '@youwho/core';

type SeatCols = Pick<typeof seats.$inferInsert, 'posKind' | 'row' | 'col' | 'label'>;

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' } as const;

/** Grid seats keep row and col; everything else keeps the page's own label text. */
export function positionToCols(p: SeatPosition): SeatCols {
  switch (p.kind) {
    case 'grid':
      return { posKind: 'grid', row: p.row, col: p.col, label: null };
    case 'extra':
      return { posKind: 'extra', row: null, col: null, label: `Extra-${p.n}` };
    case 'clash':
      return { posKind: 'clash', row: null, col: null, label: `${p.label} ${ORDINAL[p.order]} ${p.start}-${p.end}` };
    case 'other':
      return { posKind: 'other', row: null, col: null, label: p.label };
  }
}

export function colsToPosition(
  c: { posKind: string; row: number | null; col: number | null; label: string | null },
  parseSpecial: (label: string) => SeatPosition,
): SeatPosition {
  if (c.posKind === 'grid' && c.row !== null && c.col !== null) return { kind: 'grid', row: c.row, col: c.col };
  return parseSpecial(c.label ?? '');
}

export function toDataset(r: typeof datasets.$inferSelect): Dataset {
  return {
    id: r.id,
    slug: r.slug,
    label: r.label,
    sourceUrl: r.sourceUrl,
    stamp: r.stamp,
    students: r.studentsCount,
    seats: r.seatsCount,
    confirms: r.confirmCount,
    reports: r.reportCount,
    decoderKnown: r.decoderKnown,
    warnings: r.warnings,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toDatasetFull(r: typeof datasets.$inferSelect): DatasetFull {
  return { ...toDataset(r), meta: r.meta as DatasetMeta & { tba: Record<string, Course[]> } };
}
