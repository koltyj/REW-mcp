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
        lines: 52,        // Phase 2 target: 54.41% achieved, set below with buffer
        functions: 77,    // Phase 2 target: 79.7% achieved, set below with buffer
        branches: 70,     // Maintained from Phase 1 (72.68% actual)
        statements: 52    // Phase 2 target: 54.41% achieved, set below with buffer
      }
    }
  }
});
