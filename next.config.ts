import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next.js 16 merged Partial Prerendering into the `cacheComponents` mode.
  // We rely on plain Suspense streaming (same UX) for the report page and
  // leave the more invasive cacheComponents migration for a follow-up.
  // See notes/tech/ppr.md for the platform-context discussion.
};

export default nextConfig;
