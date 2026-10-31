import { createHash, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { fail, toAppError } from '@youwho/errors';
import type { Logger } from '@youwho/config';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time check of `Authorization: Bearer <secret>`. */
export function bearerMatches(header: string | undefined, secret: string): boolean {
  const given = header?.startsWith('Bearer ') ? header.slice(7) : '';
  return timingSafeEqual(digest(given), digest(secret));
}

export interface HttpDeps {
  secret: string;
  log: Logger;
  /** Record liveness and start a drain. Both endpoints do exactly this. */
  wake(): void;
}

/** /health starts a drain (it is how the web app wakes the free instance); /kick needs the bearer secret. */
export function createServer(deps: HttpDeps): http.Server {
  return http.createServer((req, res) => {
    const send = (status: number, body: unknown, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    try {
      if (req.method === 'GET' && req.url === '/health') {
        deps.wake();
        return send(200, 'ok', 'text/plain');
      }
      if (req.method === 'POST' && req.url === '/kick') {
        if (!bearerMatches(req.headers.authorization, deps.secret)) return fail('UNAUTHORIZED');
        deps.wake();
        return send(202, { ok: true });
      }
      return send(404, { ok: false, error: { code: 'INTERNAL', message: 'Not found', retryable: false } });
    } catch (e) {
      const err = toAppError(e);
      deps.log[err.def.log]({ code: err.code, route: req.url }, err.message);
      send(err.def.status, { ok: false, error: err.toPublic() });
    }
  });
}
