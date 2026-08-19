/** Backend origin. Only used by the dev/server-side rewrite, never sent to the browser. */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
