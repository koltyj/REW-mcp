# Testing Patterns

**Analysis Date:** 2026-01-21

## Test Framework

**Runner:**
- Vitest 2.1.8
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in assertions (imported as `expect`)

**Run Commands:**
```bash
npm test                 # Run all tests once
npm run test:watch      # Watch mode with automatic re-run
npm run test:coverage   # Run with v8 coverage report
```

## Test File Organization

**Location:**
- Co-located with source: Tests live in same directory as code
- Pattern: `[module].test.ts` alongside `[module].ts`
- Examples:
  - `src/analysis/decay.ts` → `src/analysis/decay.test.ts`
  - `src/analysis/reflections.ts` → `src/analysis/reflections.test.ts`
  - `src/parser/rew-text.ts` → `src/parser/rew-text.test.ts`
  - `src/api/base64-decoder.ts` → `src/api/base64-decoder.test.ts`

**Naming:**
- File pattern: `*.test.ts` (not `.spec.ts`)
- Test directories: Flat structure, no separate `__tests__` directories

**Vitest Config Details** (`vitest.config.ts`):
- `globals: true` - Use global `describe`, `it`, `expect` without imports
- `environment: 'node'` - Node.js test environment
- `include: ['src/**/*.test.ts']` - Find all test files
- Coverage provider: `v8`
- Coverage reporters: `['text', 'json', 'html']`
- Coverage includes: `['src/**/*.ts']`
- Coverage excludes: Test files and `src/types/**`

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import { functionUnderTest } from './module.js';
import type { TypeNeeded } from '../types/index.js';

describe('Module Name', () => {
  describe('functionUnderTest', () => {
    it('should do expected behavior', () => {
      // Setup
      const input = createTestData();

      // Execute
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.field).toBe(expectedValue);
    });

    it('should handle edge case', () => {
      // ...
    });
  });

  describe('anotherFunction', () => {
    // More test cases
  });
});
```

**Patterns:**

1. **Setup Pattern:** Helper functions create test data
   - Example from `src/analysis/decay.test.ts`:
   ```typescript
   function createTestIR(
     decayTimeSeconds: number = 0.5,
     sampleRate: number = 48000
   ): ImpulseResponseData {
     const duration = decayTimeSeconds * 3;
     const numSamples = Math.floor(duration * sampleRate);
     const samples: number[] = [];

     const decayRate = Math.log(1000) / (decayTimeSeconds * sampleRate);
     for (let i = 0; i < numSamples; i++) {
       const decay = Math.exp(-decayRate * i);
       const noise = (Math.random() - 0.5) * 0.001;
       samples.push(decay + noise);
     }

     return {
       samples,
       sample_rate_hz: sampleRate,
       peak_index: 0,
       start_time_s: 0,
       duration_s: duration
     };
   }
   ```

2. **Teardown Pattern:** No explicit teardown used (functional code, no state)

3. **Assertion Pattern:** Expect chains with specific assertions
   ```typescript
   expect(result).toBeCloseTo(0, 1);           // Numeric closeness
   expect(result).toBeGreaterThan(0);          // Range checks
   expect(result).toBeLessThanOrEqual(1);
   expect(array).toHaveLength(4);              // Collection checks
   expect(array).toEqual(expectedArray);
   expect(string).toContain('Hz');             // String checks
   expect(typeof value).toBe('number');        // Type checks
   ```

## Mocking

**Framework:** No mocking library explicitly configured

**Patterns:**
- Pure function testing (no mocks needed)
- Test data creation via helper functions instead of mocking
- Direct dependency injection for dependencies that exist

**What to Mock:**
- External APIs (REW API client) - use test doubles/stubs if testing API-dependent code
- File I/O operations - use in-memory test data

**What NOT to Mock:**
- Core analysis functions (test with real computations)
- Data transformations (test actual calculations)
- Zod validation (test actual validation logic)

## Fixtures and Factories

**Test Data:**

1. **Frequency Response Factory** (`src/analysis/averaging.test.ts`):
```typescript
function createTestFR(
  frequencies: number[],
  splValues: number[],
  phaseValues?: number[]
): FrequencyResponseData {
  return {
    frequencies_hz: frequencies,
    spl_db: splValues,
    phase_degrees: phaseValues || frequencies.map(() => 0)
  };
}
```

2. **Impulse Response Factory** (`src/analysis/decay.test.ts`):
```typescript
function createTestIR(
  decayTimeSeconds: number = 0.5,
  sampleRate: number = 48000
): ImpulseResponseData {
  // Build synthetic IR with exponential decay
}
```

3. **Advanced IR with Reflections** (`src/analysis/reflections.test.ts`):
```typescript
function createTestIRWithReflections(
  reflectionDelaysMs: number[] = [10, 25],
  reflectionLevels: number[] = [0.5, 0.3],
  sampleRate: number = 48000
): ImpulseResponseData {
  // Build synthetic IR with controlled reflections at specific delays
}
```

**Location:**
- Defined inline at top of test files
- Not in shared fixtures directory (each test defines its own data builders)

## Coverage

**Requirements:** None enforced (no coverage threshold)

**View Coverage:**
```bash
npm run test:coverage
# Generates:
# - Console text report
# - coverage/coverage-final.json (JSON format)
# - coverage/index.html (HTML report)
```

**Coverage Configuration:**
- Provider: `v8`
- Includes: `src/**/*.ts`
- Excludes: `src/**/*.test.ts` (test files not counted), `src/types/**` (type-only files)

## Test Types

**Unit Tests:**
- Scope: Individual functions and modules
- Approach: Test function behavior with synthetic test data
- Examples: `decay.test.ts` tests decay calculation functions, `reflections.test.ts` tests reflection analysis
- Coverage: 2,049 lines of test code across 9 test files

**Integration Tests:**
- Not explicitly separated
- Parser tests combine parsing + validation: `rew-text.test.ts` tests `parseREWExport` with realistic data

**E2E Tests:**
- Not present (CLI tool, not UI)

## Common Patterns

**Async Testing:**
```typescript
// Not commonly used - most functions are synchronous
// If needed:
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
// Example from reflections.test.ts
it('should handle threshold filtering', () => {
  const ir = createTestIRWithReflections([10, 25], [0.5, 0.1]);

  const highThreshold = detectReflections(ir, { threshold_db: -6 });
  const lowThreshold = detectReflections(ir, { threshold_db: -20 });

  expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
});

// Example for null handling
it('should return null for invalid conditions', () => {
  const result = calculateEDT(schroederWithNoRange);
  expect(result).toBeNull();
});
```

**Boundary Testing:**
```typescript
it('should return value between 0 and 1', () => {
  const ir = createTestIRWithReflections();
  const d50 = calculateD50(ir);

  expect(d50).toBeGreaterThanOrEqual(0);
  expect(d50).toBeLessThanOrEqual(1);
});
```

**Property Testing:**
```typescript
// Tests that properties hold across a range of values
it('should always have EDT <= T20 <= T30', () => {
  for (let i = 0; i < 10; i++) {
    const ir = createTestIR(Math.random() * 1);
    const schroeder = buildSchroederCurve(ir);

    const edt = calculateEDT(schroeder);
    const t20 = calculateT20(schroeder);
    const t30 = calculateT30(schroeder);

    if (edt && t20) expect(edt).toBeLessThanOrEqual(t20);
    if (t20 && t30) expect(t20).toBeLessThanOrEqual(t30);
  }
});
```

## Test Coverage Summary

**Total test code:** 2,049 lines across 9 test files

**Tested Modules:**
1. `src/analysis/decay.test.ts` - Decay calculation (T20, T30, EDT, Topt)
2. `src/analysis/reflections.test.ts` - Early reflection detection and analysis
3. `src/analysis/target-curves.test.ts` - Target curve comparison
4. `src/analysis/peaks-nulls.test.ts` - Peak and null detection
5. `src/analysis/averaging.test.ts` - RMS and vector averaging
6. `src/analysis/room-modes.test.ts` - Room mode analysis
7. `src/analysis/sub-integration.test.ts` - Subwoofer integration analysis
8. `src/parser/rew-text.test.ts` - REW text format parsing
9. `src/api/base64-decoder.test.ts` - Base64 encoding/decoding for REW API

**Not explicitly tested:**
- Tool handlers (`src/tools/*.ts`) - use input validation via Zod
- REW API client (`src/api/rew-client.ts`) - integration with live REW instance
- Measurement store (`src/store/measurement.ts`) - in-memory state management

---

*Testing analysis: 2026-01-21*
