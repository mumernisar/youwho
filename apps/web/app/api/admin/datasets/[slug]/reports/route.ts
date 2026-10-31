import { route } from '@/server/route';
import { slugParam } from '@/server/schemas';

export const GET = route({
  auth: 'admin',
  input: slugParam,
  handler: ({ input, services }) => services.admin.reports(input.slug),
});
