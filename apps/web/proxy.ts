import { NextResponse, type NextRequest } from 'next/server';
import { AppError } from '@youwho/errors';
import { DECOMMISSIONED, NOTICE_PATH } from './src/site-status';

/** Site switch: while decommissioned, "/" shows the notice, other pages go to "/", and the API is closed. */
export function proxy(req: NextRequest) {
  if (!DECOMMISSIONED) return NextResponse.next();
  const { pathname } = req.nextUrl;
  // The header's star count stays: read-only, no seating data.
  if (pathname === '/api/github') return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    const err = new AppError('SITE_DECOMMISSIONED');
    return NextResponse.json({ ok: false, error: err.toPublic() }, { status: err.def.status });
  }
  if (pathname === '/') return NextResponse.rewrite(new URL(NOTICE_PATH, req.url));
  // Temporary redirect, so browsers do not remember it once the site is back.
  return NextResponse.redirect(new URL('/', req.url), 307);
}

// Everything except build assets, Vercel's analytics script, icons, the manifest and the service worker
// (so its kill switch still reaches phones). The notice's image is served from /_next.
export const config = {
  matcher: ['/((?!_next/|_vercel/|icon.svg|favicon.ico|apple-icon.png|icons/|manifest.webmanifest|sw.js).*)'],
};
