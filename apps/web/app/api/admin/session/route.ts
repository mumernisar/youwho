import { route } from '@/server/route';
import { sessionBody } from '@/server/schemas';

export const POST = route({
  input: sessionBody,
  handler: async ({ input, services, ip, setCookie }) => {
    const { cookie } = await services.admin.signIn(input.token, ip);
    setCookie(cookie);
    return { signedIn: true as const };
  },
});

export const DELETE = route({
  handler: async ({ services, setCookie }) => {
    setCookie(services.admin.signOutCookie());
    return { signedIn: false as const };
  },
});
