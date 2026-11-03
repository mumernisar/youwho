import { route } from '@/server/route';
import { lookupQuery } from '@/server/schemas';

export const GET = route({
  input: lookupQuery,
  rateLimit: { name: 'lookup', limit: 120, windowMs: 3600_000, by: 'ip' },
  handler: ({ input, services, voter }) => services.lookup.search(input.reg, voter.hash),
});
