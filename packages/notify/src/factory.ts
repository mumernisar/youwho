import { ConsoleNotifier } from './console';
import type { Notifier, NotifyLog } from './events';
import { ResendNotifier } from './resend';

export interface NotifyEnv {
  SITE_URL?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  OWNER_EMAIL?: string | undefined;
  NOTIFY_FROM?: string | undefined;
}

/** Resend when configured, otherwise the console. */
export function createNotifier(env: NotifyEnv, log: NotifyLog): Notifier {
  if (env.RESEND_API_KEY && env.OWNER_EMAIL && env.NOTIFY_FROM) {
    return new ResendNotifier({ apiKey: env.RESEND_API_KEY, from: env.NOTIFY_FROM, to: env.OWNER_EMAIL, siteUrl: env.SITE_URL, log });
  }
  return new ConsoleNotifier(log);
}
