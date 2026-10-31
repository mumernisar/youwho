import type { SeatPosition } from './types';

/** Human label: "R3-5" is row 3 from the front, seat 5 from the left (whose left: spec section 1). */
export function seatLabel(p: SeatPosition): string {
  switch (p.kind) {
    case 'grid':
      return `R${p.row}-${p.col}`;
    case 'extra':
      return `Extra chair ${p.n}`;
    case 'clash':
      return p.label;
    case 'other':
      return p.label;
  }
}

/** Key for a grid cell, used to place seats in a room drawing. */
export const cellKey = (row: number, col: number): string => `${row}:${col}`;
