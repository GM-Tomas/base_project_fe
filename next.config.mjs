import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

// Vercel previews run on mock data (src/lib/dataSource.ts); every other build runs on real data, whatever
// its variables say, except the dev server (next dev), where NEXT_PUBLIC_DATA_SOURCE=mock opts in. VERCEL_ENV
// says "preview" for custom environments too (staging, say), so VERCEL_TARGET_ENV decides when present.
function dataSourceFor(phase) {
  const vercelTarget = process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV;
  if (process.env.VERCEL && vercelTarget === 'preview') return 'mock';
  if (phase === PHASE_DEVELOPMENT_SERVER && process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock') return 'mock';
  return 'live';
}

// The Supabase session lives in localStorage, so the CSP's main job is limiting where injected
// script could load from or send it: only this site, the API and Supabase (none of those on mock data).
// The dev server (and only it, whatever NODE_ENV says) needs eval and plain http. On mock data, with no
// session or real data to take, the Vercel Toolbar that Vercel adds to previews (comments) gets the
// sources Vercel's docs list for it (vercel.com/docs/vercel-toolbar/managing-toolbar).
const cspFor = (dataSource, isDev) => {
  const mock = dataSource === 'mock';
  const apiOrigins = mock
    ? []
    : [process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080', process.env.NEXT_PUBLIC_SUPABASE_URL]
        .filter(Boolean)
        .map((url) => new URL(url).origin);
  const toolbar = (...sources) => (mock ? sources : []);
  const directive = (name, ...sources) => [name, ...sources].join(' ');

  // ponytail: 'unsafe-inline' scripts — Next's inline bootstrap needs it without per-request nonces;
  // a nonce CSP in proxy.ts would drop it at the cost of making every page dynamic.
  return [
    "default-src 'self'",
    directive('script-src', "'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), ...toolbar('https://vercel.live')),
    directive('style-src', "'self'", "'unsafe-inline'", ...toolbar('https://vercel.live')),
    directive('img-src', "'self'", 'data:', 'blob:', ...toolbar('https://vercel.live', 'https://vercel.com')),
    directive('font-src', "'self'", ...toolbar('https://vercel.live', 'https://assets.vercel.com')),
    directive('connect-src', "'self'", ...apiOrigins, ...toolbar('https://vercel.live', 'wss://ws-us3.pusher.com')),
    ...(mock ? [directive('frame-src', "'self'", 'https://vercel.live')] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
};

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  const dataSource = dataSourceFor(phase);
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    env: { NEXT_PUBLIC_DATA_SOURCE: dataSource },
    // Vercel already adds HSTS.
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            { key: 'Content-Security-Policy', value: cspFor(dataSource, isDev) },
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
}
