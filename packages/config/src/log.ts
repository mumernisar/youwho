import pino, { type Logger } from 'pino';

export type { Logger };

/** Serializes an error and its cause chain without leaking more than message, code and stack. */
const errSerializer = (e: unknown): Record<string, unknown> => {
  if (!(e instanceof Error)) return { value: String(e) };
  const out: Record<string, unknown> = { type: e.name, message: e.message, stack: e.stack };
  if ('code' in e) out.code = e.code;
  if (e.cause !== undefined) out.cause = errSerializer(e.cause);
  return out;
};

export function createLogger(opts: { name: string; level?: string }): Logger {
  return pino({
    name: opts.name,
    level: opts.level ?? 'info',
    serializers: { err: errSerializer, cause: errSerializer },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        'headers.cookie',
        'authorization',
        'cookie',
        '*.authorization',
        '*.cookie',
        'token',
        'ip',
        'voter',
        'voterId',
        'name',
      ],
      censor: '[redacted]',
    },
  });
}
