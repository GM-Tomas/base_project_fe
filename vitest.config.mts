import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}'],
      thresholds: { statements: 85, lines: 85, functions: 85, branches: 85 },
    },
  },
});
