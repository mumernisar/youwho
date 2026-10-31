import { route } from '@/server/route';
import { roomParams } from '@/server/schemas';

export const GET = route({
  input: roomParams,
  handler: ({ input, services, voter }) => services.rooms.view(input, voter.hash),
});
