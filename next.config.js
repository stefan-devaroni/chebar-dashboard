/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Always fetch fresh data when navigating between dashboard pages. Next 14
    // otherwise reuses a visited page for 30s, so a just-created order could
    // be missing from Orders right after "Add to order".
    staleTimes: { dynamic: 0 },
  },
};

module.exports = nextConfig;
