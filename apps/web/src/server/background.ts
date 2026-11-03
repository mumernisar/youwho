import 'server-only';
import { after } from 'next/server';
import { toAppError } from '@youwho/errors';
import type { Logger } from '@youwho/config';
import { logAppError } from './log-error';

export type Defer = (name: string, task: () => Promise<void>) => void;

/** Runs a side task after the response has been sent. A failure is logged and never reaches the user. */
export function createDefer(log: Logger): Defer {
  return (name, task) =>
    after(async () => {
      try {
        await task();
      } catch (e) {
        logAppError({ log }, toAppError(e), { task: name });
      }
    });
}
