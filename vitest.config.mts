import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// next.config.mjs, through next/constants, requires @swc/helpers' ESM build as CommonJS: a VM context
// (vmThreads) can't load that, so its test runs in a worker of its own.
const NEXT_CONFIG_TEST = 'src/test/nextConfig.test.ts';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    // Tests run on real data (with fetch and Supabase mocked) unless they opt into mock data themselves,
    // whatever the shell exports.
    env: { NEXT_PUBLIC_DATA_SOURCE: 'live' },
    // The app-level flows render the whole app: ~10s each on a 4-core machine with coverage on, over the 5s default.
    testTimeout: 30_000,
    projects: [
      // One jsdom per worker instead of one per file (each file still gets a fresh context, so files stay
      // isolated): building jsdom was ~40% of the run. ~135s -> ~55s.
      { extends: true, test: { name: 'app', pool: 'vmThreads', exclude: [...configDefaults.exclude, NEXT_CONFIG_TEST] } },
      { extends: true, test: { name: 'next-config', include: [NEXT_CONFIG_TEST] } },
    ],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}'],
      thresholds: { statements: 85, lines: 85, functions: 85, branches: 85 },
    },
  },
});
