import { route } from '@/server/route';

export const GET = route({
  auth: 'admin',
  handler: ({ services }) => services.admin.list(),
});
