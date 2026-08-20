import type { NextConfig } from 'next';
import pkg from './package.json';

const nextConfig: NextConfig = {
  // Minimal self-contained server bundle — the Electron shell ships .next/standalone.
  output: 'standalone',
  serverExternalPackages: ['@electric-sql/pglite', 'node-pty', 'ws', 'web-push'],
  env: {
    NEXT_PUBLIC_OS_VERSION: `v${pkg.version}`,
    NEXT_PUBLIC_FARM_VERSION: `v${pkg.version}`,
    NEXT_PUBLIC_FARM_HASH: 'release',
  },
};

export default nextConfig;
