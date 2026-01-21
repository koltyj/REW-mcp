import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**', 'src/index.ts'],
      thresholds: {
        lines: 45,        // Current: 48.9%, start just below
        functions: 50,    // Current: 56.43%
        branches: 70,     // Current: 76.17%
        statements: 45    // Current: 48.9%
      }
    }
  }
});
