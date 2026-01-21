# Phase 2: Testing Infrastructure - Research

**Researched:** 2026-01-21
**Domain:** TypeScript testing with Vitest, MSW, MCP SDK, and Zod validation
**Confidence:** HIGH

## Summary

Phase 1 established substantial test infrastructure: 21 API integration tests with MSW, 16 MCP end-to-end tests with InMemoryTransport, and 157 unit tests across analysis modules (194 total tests). Phase 2 focuses on **extending** this foundation, not rebuilding it.

The standard approach for Phase 2 is:
1. **Coverage enforcement**: Configure Vitest thresholds + CI reporting to enforce 80%+ API client, 70%+ tool handler targets
2. **European decimal handling**: Extend existing `parseNumber()` function with comprehensive test cases
3. **Type safety via Zod**: Replace 5 files with explicit `any` types using Zod's runtime validation + type inference
4. **CI integration**: Add coverage reporting action to GitHub Actions workflow

**Primary recommendation:** Use Vitest workspace projects to enforce coverage thresholds per-module, Zod's `safeParse()` for API response validation, and vitest-coverage-report-action for PR comments with coverage diffs.

## Standard Stack

Phase 1 already established the core testing stack. Phase 2 extends it with coverage tooling.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^2.1.8 | Test runner with coverage | De facto standard for Vite/TypeScript projects in 2026, built-in coverage via v8 |
| @vitest/coverage-v8 | ^2.1.8 | V8 coverage provider | Native V8 coverage is fastest, most accurate for Node.js code |
| MSW | ^2.12.7 | HTTP-level API mocking | Industry standard for realistic HTTP mocking, reusable between test/browser |
| @modelcontextprotocol/sdk | ^1.25.2 | MCP server/client + InMemoryTransport | Official MCP SDK, InMemoryTransport for testing without network |
| Zod | ^3.23.8 | Runtime schema validation | TypeScript-first validation with static type inference, parse-don't-validate philosophy |

### Supporting (Needs Installation)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest-coverage-report-action | latest | GitHub PR coverage comments | CI - posts coverage diff in PR comments, supports branch protection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest is legacy choice, Vitest is 5-20x faster for ESM projects, native TypeScript |
| v8 coverage | Istanbul (c8) | Istanbul is older standard, v8 is native Node.js coverage, more accurate |
| MSW | nock/fetch-mock | Function-level mocks, MSW intercepts at HTTP layer (more realistic) |
| vitest-coverage-report-action | codecov-action | Codecov requires third-party service + token, has known PR failure detection bugs |

**Installation:**
```bash
# No new runtime dependencies needed
# GitHub Action added to .github/workflows/ci.yml (no npm package)
```

## Architecture Patterns

### Current Test Organization (Phase 1)
```
src/
├── api/
│   ├── rew-client.ts         # 47% coverage (21 tests)
│   ├── rew-client.test.ts    # MSW integration tests
│   └── base64-decoder.test.ts
├── analysis/                  # 86% coverage (157 tests)
│   ├── *.ts
│   └── *.test.ts
├── parser/
│   ├── rew-text.ts           # 54% coverage (9 tests)
│   └── rew-text.test.ts      # Has European decimal test
├── tools/                     # 23% coverage (16 MCP tests)
│   ├── *.ts                  # Many files have explicit `any`
│   └── index.integration.test.ts  # InMemoryTransport tests
└── index.ts                   # 0% coverage (main entry)
```

### Pattern 1: Vitest Workspace Projects for Coverage Thresholds
**What:** Separate coverage thresholds for different module types
**When to use:** When different modules have different coverage expectations (API vs tools)
**Example:**
```typescript
// vitest.config.ts
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
      exclude: ['src/**/*.test.ts', 'src/types/**'],

      // Global thresholds (Phase 2 targets)
      thresholds: {
        lines: 70,      // Phase 2: 70% minimum across all code
        functions: 65,
        branches: 65,
        statements: 70
      },

      // Per-file pattern thresholds (RECOMMENDED for Phase 2)
      perFile: true,
      thresholdAutoUpdate: false,

      // Glob-based thresholds (Vitest 2.x feature)
      // Override global for specific modules
      statements: 70,
      branches: 65,
      functions: 65,
      lines: 70,
    }
  }
});
```

**Alternative with workspace projects:**
```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'api-client',
      include: ['src/api/**/*.test.ts'],
      coverage: {
        thresholds: {
          lines: 80,    // API client: 80% target (FNDN-11)
          functions: 75,
          branches: 75,
          statements: 80
        }
      }
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'tool-handlers',
      include: ['src/tools/**/*.test.ts'],
      coverage: {
        thresholds: {
          lines: 70,    // Tool handlers: 70% target (FNDN-11)
          functions: 65,
          branches: 60,
          statements: 70
        }
      }
    }
  }
]);
```

### Pattern 2: Zod Validation for API Responses
**What:** Replace `any` types with Zod schemas that validate and infer types
**When to use:** Any API response, user input, or external data (untrusted sources)
**Example:**
```typescript
// Source: Zod official docs + LogRocket TypeScript/Zod guide

// BEFORE (explicit any in src/tools/api-audio.ts:43)
export interface ApiAudioResult {
  input_calibration?: any;  // ❌ No runtime validation, no type safety
}

// AFTER (Zod schema with type inference)
import { z } from 'zod';

const InputCalibrationSchema = z.object({
  enabled: z.boolean(),
  gain_db: z.number(),
  offset_db: z.number().optional(),
  calibration_file: z.string().optional()
});

const ApiAudioResultSchema = z.object({
  action: z.string(),
  success: z.boolean(),
  message: z.string(),
  audio_status: z.object({
    enabled: z.boolean(),
    ready: z.boolean(),
    driver: z.string().optional(),
    sample_rate: z.number().optional()
  }).optional(),
  input_calibration: InputCalibrationSchema.optional()  // ✅ Validated + typed
});

export type ApiAudioResult = z.infer<typeof ApiAudioResultSchema>;

// Usage in API response handler
async function fetchAudioStatus(): Promise<ApiAudioResult> {
  const response = await fetch('/api/audio');
  const data = await response.json();

  // Use safeParse for graceful error handling (RECOMMENDED)
  const result = ApiAudioResultSchema.safeParse(data);
  if (!result.success) {
    throw new REWApiError(
      'VALIDATION_ERROR',
      `Invalid audio status response: ${result.error.message}`,
      { zodError: result.error }
    );
  }

  return result.data;  // Fully typed, validated data
}
```

### Pattern 3: European Decimal Format Handling
**What:** Parser that handles both period (1.5) and comma (1,5) decimal separators
**When to use:** Parsing REW text exports (users may have European locale)
**Example:**
```typescript
// Source: Current implementation in src/parser/rew-text.ts:98-115
// Already exists, needs comprehensive test coverage for FNDN-12

function parseNumber(value: string): number {
  const cleaned = value.trim();

  // If contains both . and ,, likely thousands separator situation
  // European: 1.234,56 (comma is decimal)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Assume comma is decimal (European)
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }

  // If only comma, assume it's decimal
  // European: 1234,56
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.'));
  }

  // Standard format: 1234.56
  return parseFloat(cleaned);
}

// PHASE 2 NEED: Comprehensive test cases
describe('parseNumber - European decimal format (FNDN-12)', () => {
  it('should parse US format (period decimal)', () => {
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('1234.56')).toBe(1234.56);
  });

  it('should parse European format (comma decimal)', () => {
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('1234,56')).toBe(1234.56);
  });

  it('should parse European with thousands separator', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('12.345.678,90')).toBe(12345678.90);
  });

  it('should handle edge cases', () => {
    expect(parseNumber('0,0')).toBe(0);
    expect(parseNumber('-123,45')).toBe(-123.45);
    expect(parseNumber('  1,5  ')).toBe(1.5);  // Whitespace
  });
});
```

### Pattern 4: MSW Handler Organization
**What:** Organize MSW handlers by feature/domain, not all in one file
**When to use:** Already established in Phase 1, maintain for Phase 2 additions
**Example:**
```typescript
// Source: MSW official best practices + existing Phase 1 pattern

// Current pattern (from src/api/rew-client.test.ts)
// Handlers defined per-test with server.use() for test-specific overrides

describe('REWApiClient', () => {
  beforeEach(() => {
    // No default handlers - each test defines what it needs
  });

  it('should connect successfully', async () => {
    // Happy path defined inline
    server.use(
      http.get('http://127.0.0.1:4735/doc.json', () => {
        return HttpResponse.json({ info: { version: '5.30.9' } });
      })
    );
    // ... test
  });

  it('should handle 404 gracefully', async () => {
    // Error case override
    server.use(
      http.get('http://127.0.0.1:4735/doc.json', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );
    // ... test
  });
});
```

**MSW best practice:** Happy path in shared handlers file, edge cases as per-test overrides
**Phase 1 approach:** Per-test handlers for maximum isolation (KEEP THIS - works well)

### Pattern 5: InMemoryTransport for MCP Testing
**What:** Test MCP server/client without network using linked transport pair
**When to use:** Already established in Phase 1, pattern documented
**Example:**
```typescript
// Source: Existing implementation in src/index.integration.test.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

describe('MCP Server Integration', () => {
  let mcpServer: Server;
  let mcpClient: Client;

  beforeEach(async () => {
    // Create linked pair - messages pass in-memory (no network)
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    mcpServer = new Server(
      { name: 'rew-mcp', version: '1.0.0' },
      { capabilities: { tools: { listChanged: true }, logging: {} } }
    );
    registerTools(mcpServer);
    await mcpServer.connect(serverTransport);

    mcpClient = new Client({ name: 'test-client', version: '1.0.0' }, {});
    await mcpClient.connect(clientTransport);
  });

  it('should call tool via MCP protocol', async () => {
    const response = await mcpClient.callTool({
      name: 'rew.api_connect',
      arguments: {}
    });

    expect(response.isError).toBe(false);
    // ... validate response
  });
});
```

**Pattern advantages:**
- No network/port conflicts
- Fast (in-memory)
- Tests actual MCP protocol compliance
- Pairs with MSW for realistic API-level mocking

### Anti-Patterns to Avoid

- **Don't set coverage thresholds too high initially:** Start at 70-80%, increase gradually. 100% coverage is not realistic for tool handlers with complex error paths.

- **Don't use Zod for internal TypeScript interfaces:** Zod is for runtime validation of **untrusted data** (API responses, user input). Internal function parameters should use TypeScript types only.

- **Don't mock at function level when HTTP mocking is better:** MSW intercepts at HTTP layer (more realistic). Function mocks (`vi.spyOn`) are for logic testing, not integration testing.

- **Don't commit coverage HTML reports:** Add `coverage/` to `.gitignore`. Only commit JSON for CI consumption.

- **Don't test implementation details:** Test behavior/outcomes. Example: Test that parser handles European decimals correctly, not that it calls `replace(',', '.')` internally.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage reporting in PRs | Custom coverage diff script | vitest-coverage-report-action | Handles diff calculation, PR comments, branch protection integration, actively maintained |
| Runtime type validation | Manual type guards (`typeof`, `instanceof`) | Zod schemas with `safeParse()` | Automatic type inference, detailed error messages, composable schemas |
| Number parsing with locales | Custom regex for comma/period | Existing `parseNumber()` + comprehensive tests | Already handles European/US formats, just needs test coverage |
| HTTP mocking | Custom fetch wrapper | MSW v2 | Intercepts at network layer, reusable across environments, industry standard |
| MCP testing | Custom protocol implementation | InMemoryTransport | Official SDK transport, ensures protocol compliance |
| Coverage thresholds per module | Custom vitest plugins | Vitest workspace projects | Built-in since Vitest 1.x, well-documented |

**Key insight:** Phase 1 already chose the right tools (MSW, InMemoryTransport, Zod). Phase 2 is about **using them more thoroughly** (coverage enforcement, more Zod validation), not replacing them.

## Common Pitfalls

### Pitfall 1: Coverage Thresholds Failing Without Context
**What goes wrong:** CI fails with "Coverage for lines (68.3%) does not meet threshold (70%)" but developer doesn't know which files are under-covered.

**Why it happens:**
- Vitest's default coverage output shows only overall percentages
- Developer needs to manually check HTML report or JSON to find problematic files
- Per-file coverage not enforced, only global

**How to avoid:**
1. Enable `perFile: true` in coverage config (enforces thresholds per file, not just globally)
2. Use `vitest-coverage-report-action` in CI (posts file-by-file diff in PR comments)
3. Add `json-summary` reporter to vitest.config.ts (enables action to parse results)

**Warning signs:**
- CI failures that say "coverage below threshold" without file names
- Developers running `npm run test:coverage` and checking HTML report manually
- Coverage drifting downward over time without detection

### Pitfall 2: Zod Validation Performance Overhead
**What goes wrong:** Validating large arrays (4096-point frequency responses) with Zod adds 10-50ms latency per request.

**Why it happens:**
- Zod validates every array element
- REW frequency responses have 4096+ data points
- Each data point is validated as `z.number()`

**How to avoid:**
1. **Don't validate array elements when size is known-safe:** Use `z.array(z.unknown())` instead of `z.array(z.number())` for large data arrays that have been validated at HTTP level
2. **Validate structure, not data:** Validate that `frequencies` is an array, not each frequency value
3. **Use `.passthrough()` for partial validation:** `ResponseSchema.passthrough()` validates known fields, allows unknown

**Warning signs:**
- Tool execution time increases significantly after adding Zod
- Performance profiling shows `ZodArray.parse` in hot path
- Integration tests take noticeably longer

**Recommended pattern for Phase 2:**
```typescript
// For large data arrays from REW API
const FrequencyResponseSchema = z.object({
  frequencies: z.unknown(),  // Array validated by MSW in tests, type-asserted
  magnitude: z.unknown(),
  phase: z.unknown()
});

// For metadata/control data
const MeasurementMetadataSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  type: z.enum(['SPL', 'Impedance', 'IR']),
  sampleRate: z.number().positive()
});
```

### Pitfall 3: European Decimal Format Edge Cases
**What goes wrong:** Parser handles `1,5` correctly but fails on `1.234,56` or misparses `1,234.56` (US thousands separator).

**Why it happens:**
- Current `parseNumber()` has basic logic: "if has comma, replace with period"
- Ambiguity: Is `1,234` European decimal (1.234) or US thousands separator (1234)?
- REW exports may include thousands separators in some locales

**How to avoid:**
1. **Test both formats explicitly:** Add tests for US (`1,234.56` = 1234.56) vs European (`1.234,56` = 1234.56)
2. **Document assumptions:** Parser assumes European format if comma appears (REW uses consistent format per export)
3. **Add integration test with real REW exports:** Test with actual REW files from European users

**Warning signs:**
- Parser test only has one European decimal case (`1,5`)
- No tests for thousands separators
- No tests for ambiguous cases

**Recommended test additions (FNDN-12):**
```typescript
describe('parseNumber - comprehensive European format', () => {
  // Already tested (src/parser/rew-text.test.ts:49-59)
  it('handles simple European comma decimal', () => {
    expect(parseNumber('20,0')).toBe(20.0);
  });

  // MISSING - Add for Phase 2
  it('handles European thousands separator + comma decimal', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('12.345.678,90')).toBe(12345678.90);
  });

  it('handles negative European decimals', () => {
    expect(parseNumber('-123,45')).toBe(-123.45);
    expect(parseNumber('-1.234,56')).toBe(-1234.56);
  });

  it('handles edge case: zero', () => {
    expect(parseNumber('0,0')).toBe(0);
  });
});
```

### Pitfall 4: CI Coverage Upload Timing
**What goes wrong:** Coverage upload to Codecov/coverage-report-action fails because test:coverage hasn't finished writing files.

**Why it happens:**
- GitHub Actions run steps in parallel or immediately after previous step
- Vitest writes coverage files asynchronously
- Upload action reads coverage file before it's fully written

**How to avoid:**
1. **Use `run: npm run test:coverage` as single command** (not `npm test && npm run coverage`)
2. **Check coverage file exists before upload:**
```yaml
- name: Test coverage
  if: matrix.node-version == '22.x'
  run: npm run test:coverage

- name: Verify coverage exists
  if: matrix.node-version == '22.x'
  run: test -f coverage/coverage-final.json

- name: Upload coverage
  if: matrix.node-version == '22.x'
  uses: davelosert/vitest-coverage-report-action@v2
```

**Warning signs:**
- Intermittent CI failures on coverage upload step
- Error: "coverage-final.json not found"
- Coverage works locally but fails in CI

### Pitfall 5: Type Safety False Sense of Security
**What goes wrong:** Adding Zod validation but still using type assertions (`as`) defeats runtime safety.

**Why it happens:**
- Developer adds Zod schema but uses `data as ApiAudioResult` instead of `.parse(data)`
- Type assertion bypasses runtime validation
- Defeats purpose of Zod

**How to avoid:**
1. **Always use `.parse()` or `.safeParse()`**, never type assertions after adding Zod
2. **Lint rule:** Consider adding ESLint rule to ban `as` in files with Zod schemas
3. **Code review:** Flag any `as Type` when Zod schema exists for Type

**Warning signs:**
```typescript
// ❌ BAD - Zod not actually validating
const data = await response.json();
const validated = data as ApiAudioResult;  // Type assertion, Zod unused!

// ✅ GOOD - Zod validates at runtime
const data = await response.json();
const validated = ApiAudioResultSchema.parse(data);  // Runtime validation
```

## Code Examples

Verified patterns from official sources:

### Vitest Coverage Configuration with Thresholds
```typescript
// Source: https://vitest.dev/config/coverage
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'html'],

      // Phase 2 targets (FNDN-11)
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 65,
        statements: 70
      },

      // Per-file enforcement
      perFile: true,

      // Include/exclude
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        'src/index.ts'  // Entry point, tested via integration
      ]
    }
  }
});
```

### GitHub Actions CI with Coverage
```yaml
# Source: vitest-coverage-report-action docs + existing .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test with coverage
        run: npm run test:coverage

      # NEW for Phase 2 - Coverage reporting in PRs
      - name: Report coverage
        if: matrix.node-version == '22.x' && github.event_name == 'pull_request'
        uses: davelosert/vitest-coverage-report-action@v2
        with:
          json-summary-path: ./coverage/coverage-summary.json
          json-final-path: ./coverage/coverage-final.json
```

### Zod Validation Replacing `any` Types
```typescript
// Source: Zod docs + LogRocket Zod guide
import { z } from 'zod';

// Example: src/tools/api-audio.ts (currently has `any` at line 43)

// BEFORE
export interface ApiAudioResult {
  input_calibration?: any;
}

// AFTER
const InputCalibrationSchema = z.object({
  enabled: z.boolean(),
  gain_db: z.number(),
  offset_db: z.number().optional(),
  calibration_file: z.string().optional()
});

export const ApiAudioResultSchema = z.object({
  action: z.string(),
  success: z.boolean(),
  message: z.string(),
  input_calibration: InputCalibrationSchema.optional()
});

export type ApiAudioResult = z.infer<typeof ApiAudioResultSchema>;

// Usage with safeParse (RECOMMENDED for external data)
async function fetchAudioStatus(): Promise<ApiAudioResult> {
  const response = await fetch('/api/audio');
  const data = await response.json();

  const result = ApiAudioResultSchema.safeParse(data);
  if (!result.success) {
    throw new REWApiError(
      'VALIDATION_ERROR',
      `Invalid API response: ${result.error.message}`,
      { zodError: result.error }
    );
  }

  return result.data;
}
```

### European Decimal Test Cases
```typescript
// Source: Current implementation src/parser/rew-text.ts + research on locale number parsing
describe('parseNumber - European decimal format (FNDN-12)', () => {
  it('parses US format (period decimal)', () => {
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('1234.56')).toBe(1234.56);
  });

  it('parses European format (comma decimal)', () => {
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('1234,56')).toBe(1234.56);
  });

  it('parses European with thousands separator', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('12.345.678,90')).toBe(12345678.90);
  });

  it('handles negative values', () => {
    expect(parseNumber('-123,45')).toBe(-123.45);
    expect(parseNumber('-1.234,56')).toBe(-1234.56);
  });

  it('handles whitespace', () => {
    expect(parseNumber('  1,5  ')).toBe(1.5);
  });

  it('handles zero', () => {
    expect(parseNumber('0,0')).toBe(0);
    expect(parseNumber('0.0')).toBe(0);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest + c8 coverage | Vitest with native v8 | 2023-2024 | 5-20x faster test runs, native ESM support, simpler config |
| Manual type guards | Zod runtime validation | 2024-2026 | Type inference eliminates duplicate declarations, runtime safety |
| nock/fetch-mock | MSW v2 | 2024 (MSW v2 release) | HTTP-level mocking, reusable across test/browser, better DevEx |
| Codecov service | GitHub Action coverage reports | 2025-2026 | No third-party service, no tokens, PR comments built-in |
| Manual coverage checks | Vitest thresholds + perFile | Vitest 1.x+ | Automatic enforcement, per-file granularity, fails CI on drop |

**Deprecated/outdated:**
- **Jest for TypeScript ESM projects:** Jest requires `ts-jest` transform, slow. Vitest native TypeScript support.
- **Istanbul (c8) coverage:** Use native v8 coverage provider in Vitest (more accurate, faster).
- **Function-level HTTP mocks (nock):** MSW is industry standard since 2024, HTTP-level interception.
- **`z.parse()` without error handling:** Use `z.safeParse()` for external data to avoid throwing (better error messages).

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal coverage threshold for tool handlers**
   - What we know: Current coverage is 23.34% for src/tools/, target is 70%+
   - What's unclear: Whether 70% is achievable for tool handlers with complex error paths, or if 60% is more realistic
   - Recommendation: Start at 60% for tools/, 80% for API client, increase incrementally. Monitor which files consistently fail threshold.

2. **InMemoryTransport testing patterns for advanced scenarios**
   - What we know: Basic pattern established (createLinkedPair, test tool calls). Works for current tests.
   - What's unclear: Best practices for testing cancellation, streaming responses, progress updates (if MCP adds these)
   - Recommendation: Phase 1 pattern is sufficient for Phase 2. Revisit if MCP SDK adds complex features.

3. **Zod validation performance impact on large arrays**
   - What we know: Validating 4096-element arrays with Zod can add latency. Phase 1 tests use realistic array sizes.
   - What's unclear: Exact performance impact of Zod on production (tests mock data, no real network latency)
   - Recommendation: Use `z.unknown()` for large data arrays, validate structure not elements. Profile if performance issues arise.

## Sources

### Primary (HIGH confidence)
- [Vitest Coverage Configuration](https://vitest.dev/config/coverage) - Official coverage thresholds, reporters, per-file enforcement
- [Vitest Test Projects](https://vitest.dev/guide/projects) - Workspace configuration for separate coverage targets
- [Zod Official Documentation](https://zod.dev/) - Runtime validation, type inference, safeParse patterns
- [MSW Official Documentation](https://mswjs.io/) - HTTP mocking best practices, handler organization
- [MSW Best Practices: Structuring Handlers](https://mswjs.io/docs/best-practices/structuring-handlers/) - Happy path first, domain-based organization
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK, InMemoryTransport reference

### Secondary (MEDIUM confidence)
- [Vitest Code Coverage with GitHub Actions](https://medium.com/@alvarado.david/vitest-code-coverage-with-github-actions-report-compare-and-block-prs-on-low-coverage-67fceaa79a47) - PR coverage reporting, blocking low coverage
- [vitest-coverage-report-action](https://github.com/davelosert/vitest-coverage-report-action) - GitHub Action for coverage PR comments
- [LogRocket: TypeScript vs Zod Guide](https://blog.logrocket.com/when-use-zod-typescript-both-developers-guide/) - When to use Zod vs TypeScript, best practices
- [MDN: Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) - Locale number formatting (context for European decimals)
- Existing codebase: `src/parser/rew-text.ts:98-115` (parseNumber implementation), `src/api/rew-client.test.ts` (MSW pattern), `src/index.integration.test.ts` (InMemoryTransport pattern)

### Tertiary (LOW confidence)
- [Zod GitHub Discussion: European Decimal Parsing](https://github.com/colinhacks/zod/discussions/3339) - Community discussion, no official solution
- [GitHub Issue: Codecov CI Failure Detection](https://github.com/codecov/codecov-action/issues/674) - Known bug in codecov-action (why we use vitest-coverage-report-action instead)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest, MSW, Zod are established standards, Phase 1 already uses them
- Architecture: HIGH - Patterns verified from official docs + existing Phase 1 implementation
- Pitfalls: MEDIUM - Based on common issues in documentation/discussions, not all verified in this codebase
- European decimal handling: HIGH - Implementation already exists, needs test coverage
- Zod validation: HIGH - Official docs + community best practices well-documented
- Coverage thresholds: MEDIUM - Standard practice, but optimal thresholds project-specific

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stack is stable, Vitest/Zod/MSW mature projects)

**Key findings for planner:**
1. Phase 1 chose the right tools - Phase 2 extends usage, doesn't replace
2. Current coverage: API 47%, tools 23%, analysis 86%. Targets: API 80%+, tools 70%+.
3. European decimal parser exists (src/parser/rew-text.ts:98-115), needs comprehensive tests
4. 5 files have explicit `any` types (found via grep): api-audio.ts, api-measure.ts, api-measure-workflow.ts, rew-client.ts, glm-interpret.ts
5. CI already runs coverage (ci.yml:39-41), needs reporting action + threshold enforcement
