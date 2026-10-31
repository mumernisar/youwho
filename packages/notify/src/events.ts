export type OwnerEvent =
  | { type: 'dataset.added'; slug: string; label: string; sourceUrl: string; students: number; seats: number; warnings: string[] }
  | { type: 'dataset.updated'; slug: string; label: string; sourceUrl: string; changed: true; seatsBefore: number; seatsAfter: number }
  | { type: 'dataset.reported'; slug: string; label: string; sourceUrl: string; reason: string; note?: string; reports: number; confirms: number }
  | { type: 'decoder.unknown'; slug: string; sourceUrl: string; logicHash: string };

/** `send` never throws: failures are logged and dropped. */
export interface Notifier {
  send(event: OwnerEvent): Promise<void>;
}

/** The slice of a logger the notifiers need, so this package does not depend on pino. */
export interface NotifyLog {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
}
