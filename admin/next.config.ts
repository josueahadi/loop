import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker runtime
  // image ships only the traced production files — no full node_modules needed.
  output: 'standalone',
};

export default nextConfig;
