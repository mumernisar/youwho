import { route } from '@/server/route';
import { deleteBody } from '@/server/schemas';

export const POST = route({
  auth: 'admin',
  input: deleteBody,
  handler: ({ input, services }) => services.admin.delete(input.slugs),
});
