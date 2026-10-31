import 'server-only';
import { roomSlug } from '@youwho/core';
import type { Repos } from '@youwho/db';
import type { RoomViewData } from '../schemas';
import { toSummary, type DatasetService } from './datasets';

export class RoomService {
  constructor(
    private readonly repos: Repos,
    private readonly datasets: DatasetService,
  ) {}

  async view(opts: { slug: string; room: string; slotKey: string }, voterHash: string | null): Promise<RoomViewData> {
    const [v, confirmed] = await Promise.all([
      this.repos.seats.roomView({ datasetSlug: opts.slug, roomSlug: opts.room, slotKey: opts.slotKey }),
      this.datasets.confirmedFor(voterHash),
    ]);
    return {
      dataset: toSummary(v.dataset, confirmed),
      room: v.room,
      roomSlug: roomSlug(v.room),
      slot: v.slot,
      dims: v.dims,
      courses: v.courses,
      seats: v.seats,
    };
  }
}
