import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { Services } from './services';

export const VOTER_COOKIE = 'yw_vid';
const YEAR_S = 365 * 24 * 3600;

export interface VoterId {
  id: string;
  hash: string;
  isNew: boolean;
}

/** Voter from the request cookie, or a fresh id (the route wrapper sets the cookie on the response). */
export function voterFromRequest(req: NextRequest, s: Services): VoterId {
  const existing = req.cookies.get(VOTER_COOKIE)?.value;
  const id = existing && /^[0-9a-f-]{36}$/.test(existing) ? existing : s.newId();
  return { id, hash: s.hash(`voter:${id}`), isNew: id !== existing };
}

export function setVoterCookie(res: NextResponse | Response, voter: VoterId): void {
  res.headers.append(
    'set-cookie',
    `${VOTER_COOKIE}=${voter.id}; Path=/; Max-Age=${YEAR_S}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  );
}

/** Voter hash for server components (read-only): null when the visitor has no cookie yet. */
export async function viewerHash(s: Services): Promise<string | null> {
  const id = (await cookies()).get(VOTER_COOKIE)?.value;
  return id && /^[0-9a-f-]{36}$/.test(id) ? s.hash(`voter:${id}`) : null;
}
