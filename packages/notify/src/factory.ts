import { ConsoleNotifier } from './console';
import type { Notifier, NotifyLog } from './events';

export interface NotifyEnv {
  RESEND_API_KEY?: string | undefined;
  OWNER_EMAIL?: string | undefined;
  NOTIFY_FROM?: string | undefined;
}

/** Resend when configured, otherwise the console. (The Resend notifier arrives with the admin phase.) */
export function createNotifier(_env: NotifyEnv, log: NotifyLog): Notifier {
  return new ConsoleNotifier(log);
}
