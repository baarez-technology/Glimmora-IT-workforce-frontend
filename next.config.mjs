/** Backend origin. Only used by the dev/server-side rewrite, never sent to the browser. */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Where the build output goes.
   *
   * `next dev` and `next build` both write to `.next` by default, so running a
   * verification build while a dev server is up replaces the chunks that server
   * is still serving — it then fails with "Cannot find module './1234.js'".
   * Set NEXT_DIST_DIR to build somewhere else and leave the dev server alone:
   *
   *     NEXT_DIST_DIR=.next-verify npx next build
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  /**
   * Proxy the API through the Next server so the browser always talks to one
   * origin. This is what makes the httpOnly refresh-token cookie work in local
   * development (SameSite=Lax cannot cross :3000 -> :8000), and it mirrors the
   * production topology where Nginx serves the app and proxies /api.
   */
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` }];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
