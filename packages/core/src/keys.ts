import type { SlotKey } from './types';

/**
 * "2026-11-03T08:30-09:50". The end time is part of the key: two papers that start together but end
 * at different times are different sessions, and a room view shows only its own.
 */
export const slotKey = (date: string, start: string, end: string): SlotKey => `${date}T${start}-${end}`;

export const SLOT_KEY_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}-\d{2}:\d{2}$/;

/** Split a slot key back into its parts. */
export function parseSlotKey(key: SlotKey): { date: string; start: string; end: string } {
  return { date: key.slice(0, 10), start: key.slice(11, 16), end: key.slice(17, 22) };
}

/** "G-05" → "g-05", "Clash Room" → "clash-room". */
export const roomSlug = (room: string): string =>
  room.trim().toLowerCase().replace(/\s+/g, '-');
