const isDev = process.env.NODE_ENV !== 'production';

// Vercel previews run on mock data (src/lib/dataSource.ts). Any other production build never does, whatever
// its variables say; in local development (next dev), NEXT_PUBLIC_DATA_SOURCE=mock opts in. VERCEL_ENV says
// "preview" for custom environments too (staging, say), so VERCEL_TARGET_ENV decides when present.
const vercelTarget = process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV;
const dataSource =
  vercelTarget === 'preview' || (isDev && process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock') ? 'mock' : 'live';

// The Supabase session lives in localStorage, so the CSP's main job is limiting where injected
// script could load from or send it: only this site, the API and Supabase (none of those on mock data).
const apiOrigins =
  dataSource === 'mock'
    ? []
    : [process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080', process.env.NEXT_PUBLIC_SUPABASE_URL]
        .filter(Boolean)
        .map((url) => new URL(url).origin);

// ponytail: 'unsafe-inline' scripts — Next's inline bootstrap needs it without per-request nonces;
// a nonce CSP in proxy.ts would drop it at the cost of making every page dynamic.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  ['connect-src', "'self'", ...apiOrigins].join(' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_DATA_SOURCE: dataSource },
  // Vercel already adds HSTS.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
