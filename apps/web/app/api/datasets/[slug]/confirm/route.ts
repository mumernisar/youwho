import { route } from '@/server/route';
import { slugParam } from '@/server/schemas';

export const POST = route({
  input: slugParam,
  rateLimit: { name: 'confirm', limit: 30, windowMs: 3600_000, by: 'voter' },
  handler: ({ input, services, voter }) => services.feedback.confirm(input.slug, voter.hash),
});
