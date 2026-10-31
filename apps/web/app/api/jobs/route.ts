import { route } from '@/server/route';
import { jobBody } from '@/server/schemas';

export const POST = route({
  input: jobBody,
  // Per-requester job limits live in JobService; this only guards against hammering the endpoint itself.
  rateLimit: { name: 'jobs-post', limit: 60, windowMs: 3600_000, by: 'ip' },
  handler: ({ input, services, voter, ipHash }) => services.jobs.submit({ url: input.url, kind: input.kind, requesterHash: ipHash }, voter.hash),
});
