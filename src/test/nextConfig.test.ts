import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants.js';
import nextConfig from '../../next.config.mjs';

afterEach(() => {
  vi.unstubAllEnvs();
});

const build = (phase: string, env: Record<string, string>) => {
  for (const key of ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'NEXT_PUBLIC_DATA_SOURCE', 'NODE_ENV']) {
    vi.stubEnv(key, env[key] ?? '');
  }
  return nextConfig(phase);
};

const csp = async (config: ReturnType<typeof nextConfig>) => {
  const [rule] = await config.headers!();
  return rule.headers.find((h) => h.key === 'Content-Security-Policy')!.value;
};

// The build-time switch that keeps production on real data and previews on demo data.
describe('next.config.mjs data source', () => {
  it.each([
    ['a Vercel preview', PHASE_PRODUCTION_BUILD, { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview' }, 'mock'],
    ['an older preview without VERCEL_TARGET_ENV', PHASE_PRODUCTION_BUILD, { VERCEL: '1', VERCEL_ENV: 'preview' }, 'mock'],
    ['production', PHASE_PRODUCTION_BUILD, { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production' }, 'live'],
    ['production asking for mock', PHASE_PRODUCTION_BUILD, { VERCEL: '1', VERCEL_ENV: 'production', NEXT_PUBLIC_DATA_SOURCE: 'mock' }, 'live'],
    ['a custom environment', PHASE_PRODUCTION_BUILD, { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'staging' }, 'live'],
    ['a build asking for mock, even with NODE_ENV=development', PHASE_PRODUCTION_BUILD, { NEXT_PUBLIC_DATA_SOURCE: 'mock', NODE_ENV: 'development' }, 'live'],
    ['the dev server asking for mock', PHASE_DEVELOPMENT_SERVER, { NEXT_PUBLIC_DATA_SOURCE: 'mock' }, 'mock'],
    ['the dev server', PHASE_DEVELOPMENT_SERVER, {}, 'live'],
  ])('%s → %s', (_name, phase, env, dataSource) => {
    expect(build(phase, env).env).toEqual({ NEXT_PUBLIC_DATA_SOURCE: dataSource });
  });

  it('lets a mock build reach only the site and the Vercel Toolbar, a live one only its API and Supabase', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co/');
    const preview = await csp(build(PHASE_PRODUCTION_BUILD, { VERCEL: '1', VERCEL_TARGET_ENV: 'preview' }));
    expect(preview).toContain("connect-src 'self' https://vercel.live wss://ws-us3.pusher.com;");
    expect(preview).toContain("script-src 'self' 'unsafe-inline' https://vercel.live;");
    expect(preview).toContain("frame-src 'self' https://vercel.live;");
    const production = await csp(build(PHASE_PRODUCTION_BUILD, { VERCEL: '1', VERCEL_TARGET_ENV: 'production' }));
    expect(production).toContain("connect-src 'self' https://api.example.com https://ref.supabase.co;");
    expect(production).toContain("script-src 'self' 'unsafe-inline';");
    expect(production).not.toMatch(/vercel\.live|pusher|frame-src|unsafe-eval/);
    expect(production).toContain('upgrade-insecure-requests');
  });

  it('relaxes the CSP for the dev server only, whatever NODE_ENV says', async () => {
    expect(await csp(build(PHASE_DEVELOPMENT_SERVER, {}))).toContain("'unsafe-eval'");
    const devNodeEnvBuild = await csp(build(PHASE_PRODUCTION_BUILD, { NODE_ENV: 'development' }));
    expect(devNodeEnvBuild).not.toContain("'unsafe-eval'");
    expect(devNodeEnvBuild).toContain('upgrade-insecure-requests');
  });
});
