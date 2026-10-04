/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel already adds HSTS; these block clickjacking, MIME sniffing and full-URL referrers.
  // ponytail: no CSP — Next 14 needs 'unsafe-inline' without nonces; add a nonce CSP in middleware if XSS hardening becomes a priority.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
