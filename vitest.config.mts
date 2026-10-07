import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

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
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}'],
      thresholds: { statements: 85, lines: 85, functions: 85, branches: 85 },
    },
  },
});
