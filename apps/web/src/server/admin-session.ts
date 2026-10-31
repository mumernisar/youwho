import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const ADMIN_COOKIE = 'yw_admin';
export const ADMIN_SESSION_S = 7 * 24 * 3600;

const sign = (secret: string, exp: number) => createHmac('sha256', secret).update(`admin:${exp}`).digest('hex');

/** `<expiry>.<hmac>`: signed with SESSION_SECRET, so it cannot be forged or extended. */
export function createAdminSession(secret: string, nowMs: number): string {
  const exp = Math.floor(nowMs / 1000) + ADMIN_SESSION_S;
  return `${exp}.${sign(secret, exp)}`;
}

export function verifyAdminSession(value: string | undefined, secret: string, nowMs: number): boolean {
  const [expRaw, mac] = value?.split('.') ?? [];
  const exp = Number(expRaw);
  if (!mac || !Number.isInteger(exp) || exp * 1000 < nowMs) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(secret, exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Constant-time compare of the submitted token with ADMIN_TOKEN. */
export function tokenMatches(given: string, expected: string): boolean {
  return timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());
}

export const isAdminRequest = (req: NextRequest, secret: string, nowMs: number): boolean =>
  verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value, secret, nowMs);

export function sessionCookie(value: string, maxAgeS: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${value}; Path=/; Max-Age=${maxAgeS}; HttpOnly; SameSite=Strict${secure}`;
}
