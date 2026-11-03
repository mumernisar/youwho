'use client';

import { Analytics as VercelAnalytics, type BeforeSendEvent } from '@vercel/analytics/next';

/** Registration numbers stay on the site: /r/<reg> is sent as /r/[reg] and query strings (?me=) are dropped. */
function redact(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = '';
  url.pathname = url.pathname.replace(/^\/r\/[^/]+/, '/r/[reg]');
  return { ...event, url: url.toString() };
}

export function Analytics() {
  return <VercelAnalytics beforeSend={redact} />;
}
