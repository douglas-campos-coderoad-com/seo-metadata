/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone — a self-contained server the production Docker
  // image runs directly, without shipping the full node_modules tree.
  output: 'standalone',
  env: {
    API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1',
  },
};

module.exports = nextConfig;
