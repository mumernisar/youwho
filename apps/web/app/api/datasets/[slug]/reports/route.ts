import { route } from '@/server/route';
import { reportBody } from '@/server/schemas';

export const POST = route({
  input: reportBody,
  rateLimit: { name: 'report', limit: 10, windowMs: 3600_000, by: 'ip' },
  handler: ({ input, services, voter }) => services.feedback.report({ ...input, voterHash: voter.hash }),
});
