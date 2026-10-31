import { route } from '@/server/route';

export const GET = route({
  handler: ({ services, voter }) => services.datasets.list(voter.hash),
});
