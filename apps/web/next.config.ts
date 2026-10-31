import type { NextConfig } from 'next';

// Local development reads apps/web/.env, a symlink to the repo-root .env (see README).
const config: NextConfig = {
  transpilePackages: ['@youwho/core', '@youwho/db', '@youwho/errors', '@youwho/config'],
  serverExternalPackages: ['postgres', 'pino'],
  poweredByHeader: false,
  agentRules: false,
};

export default config;
