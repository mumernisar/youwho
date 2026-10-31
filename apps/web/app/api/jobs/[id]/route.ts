import { route } from '@/server/route';
import { idParam } from '@/server/schemas';

export const GET = route({
  input: idParam,
  handler: ({ input, services }) => services.jobs.status(input.id),
});
