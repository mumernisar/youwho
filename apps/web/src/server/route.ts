import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';
import { AppError, fail, toAppError } from '@youwho/errors';
import { isAdminRequest } from './admin-session';
import { getServices, type Services } from './services';
import { setVoterCookie, voterFromRequest, type VoterId } from './voter';

export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowMs: number;
  by: 'ip' | 'voter';
}

interface Ctx<I> {
  input: I;
  services: Services;
  req: NextRequest;
  requestId: string;
  voter: VoterId;
  /** Hashed client address, for per-requester limits. */
  ipHash: string;
  /** Raw client address; only for hashing, never stored or logged. */
  ip: string;
  /** Queue a Set-Cookie header for the response. */
  setCookie(header: string): void;
}

const clientIp = (req: NextRequest): string =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

const issues = (e: z.ZodError) =>
  e.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));

/**
 * Every API route is built with this: input parsing, rate limiting, error mapping, logging and
 * request ids are identical everywhere. Input is merged from route params, query and JSON body.
 */
export function route<I = undefined, O = unknown>(opts: {
  input?: z.ZodType<I>;
  auth?: 'admin';
  rateLimit?: RateLimitPolicy;
  handler: (ctx: Ctx<I>) => Promise<O>;
}) {
  return async (req: NextRequest, routeCtx?: { params?: Promise<Record<string, string>> }): Promise<Response> => {
    const requestId = crypto.randomUUID();
    let services: Services | undefined;
    let voter: VoterId | undefined;
    try {
      services = getServices();
      voter = voterFromRequest(req, services);
      if (opts.auth === 'admin' && !isAdminRequest(req, services.env.SESSION_SECRET, services.now().getTime())) fail('UNAUTHORIZED');

      if (opts.rateLimit) {
        const p = opts.rateLimit;
        const who = p.by === 'voter' ? voter.hash : services.hash(`ip:${clientIp(req)}`);
        const r = await services.repos.rateLimits.hit({ key: `${p.name}:${who}`, limit: p.limit, windowMs: p.windowMs, now: services.now() });
        if (!r.allowed) fail('RATE_LIMITED', { details: { retryAfterSec: r.retryAfterSec } });
      }

      let input = undefined as I;
      if (opts.input) {
        const raw: Record<string, unknown> = {
          ...(routeCtx?.params ? await routeCtx.params : {}),
          ...Object.fromEntries(req.nextUrl.searchParams),
        };
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const body: unknown = await req.json().catch(() => ({}));
          if (body && typeof body === 'object') Object.assign(raw, body);
        }
        const parsed = opts.input.safeParse(raw);
        if (!parsed.success) return fail('INVALID_INPUT', { details: { issues: issues(parsed.error) }, cause: parsed.error });
        input = parsed.data;
      }

      const cookies: string[] = [];
      const ip = clientIp(req);
      const data = await opts.handler({ input, services, req, requestId, voter, ip, ipHash: services.hash(`ip:${ip}`), setCookie: (h) => void cookies.push(h) });
      const res = NextResponse.json({ ok: true, data });
      for (const c of cookies) res.headers.append('set-cookie', c);
      if (voter.isNew) setVoterCookie(res, voter);
      return res;
    } catch (e) {
      const err = toAppError(e);
      logAppError(services, err, { requestId, route: req.nextUrl.pathname });
      const headers: Record<string, string> = {};
      const retry = (err.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
      if (retry) headers['retry-after'] = String(retry);
      return NextResponse.json({ ok: false, error: err.toPublic(requestId) }, { status: err.def.status, headers });
    }
  };
}

export function logAppError(s: Services | undefined, err: AppError, fields: Record<string, unknown>): void {
  const line = { ...fields, code: err.code, ...(err.def.log === 'error' ? { err: err.cause ?? err } : {}) };
  const log = s?.log;
  if (!log) return console.error(JSON.stringify({ level: 'error', msg: err.message, ...fields, code: err.code }));
  log[err.def.log](line, err.message);
}
