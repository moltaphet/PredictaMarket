import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this app (a stray lockfile lives higher up the tree).
  turbopack: { root: __dirname },
};

export default nextConfig;
