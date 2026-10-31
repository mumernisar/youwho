import type { SlotKey } from './types';

export const slotKey = (date: string, start: string): SlotKey => `${date}T${start}`;

export const SLOT_KEY_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "G-05" → "g-05", "Clash Room" → "clash-room". */
export const roomSlug = (room: string): string =>
  room.trim().toLowerCase().replace(/\s+/g, '-');
