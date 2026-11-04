import type { NextConfig } from 'next';

// Local development reads apps/web/.env, a symlink to the repo-root .env (see README).
const config: NextConfig = {
  transpilePackages: ['@youwho/core', '@youwho/db', '@youwho/errors', '@youwho/config', '@youwho/notify'],
  serverExternalPackages: ['postgres', 'pino'],
  poweredByHeader: false,
  agentRules: false,
  // The service worker must never be cached, so a fix (or the kill switch) reaches phones on their next visit.
  headers: async () => [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }],
  // iOS and link-preview bots guess these old root paths (with size and -precomposed variants) before reading the page's link tag.
  rewrites: async () => [
    { source: '/:file(apple-touch-icon(?:-\\d+x\\d+)?(?:-precomposed)?\\.png)', destination: '/apple-icon.png' },
  ],
};

export default config;
