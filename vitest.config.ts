import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/**/__tests__/**/*.test.{js,ts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.js'],
      thresholds: {
        'src/lib/supersay-api.js': {
          branches: 80,
          functions: 100,
          lines: 95,
          statements: 95,
        },
      },
    },
    globals: true,
  },
});
