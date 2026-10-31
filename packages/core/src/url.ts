import { fail } from '@youwho/errors';

/**
 * Canonical form of a public Google Sites page: https://sites.google.com/view/<site>[/<page>...]
 * Lowercased, no query, hash or trailing slash. Anything else is INVALID_SOURCE_URL.
 */
export function canonicalizeSourceUrl(input: string): string {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch (cause) {
    return fail('INVALID_SOURCE_URL', { cause });
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') fail('INVALID_SOURCE_URL');
  if (u.hostname.toLowerCase() !== 'sites.google.com') fail('INVALID_SOURCE_URL');
  if (u.username || u.password || u.port) fail('INVALID_SOURCE_URL');
  const parts = u.pathname.toLowerCase().split('/').filter(Boolean);
  if (parts[0] !== 'view' || parts.length < 2 || parts.some((p) => p.length > 200)) {
    fail('INVALID_SOURCE_URL');
  }
  return `https://sites.google.com/${parts.join('/')}`;
}

/** Dataset slug from a canonical URL: "cs-mid-term-fa26-students". */
export function slugFromSourceUrl(canonical: string): string {
  const parts = new URL(canonical).pathname.split('/').filter(Boolean).slice(1);
  return parts.join('-').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'department';
}
