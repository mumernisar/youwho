import { route } from '@/server/route';

export const GET = route({
  handler: async ({ services }) => ({ stars: await services.github.stars(), url: services.github.url }),
});
