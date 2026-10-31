import { route } from '@/server/route';

export const POST = route({
  rateLimit: { name: 'wake', limit: 20, windowMs: 3600_000, by: 'ip' },
  handler: async ({ services }) => {
    await services.scraper.wake();
    return { ok: true as const };
  },
});
