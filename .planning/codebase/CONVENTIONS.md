# Coding Conventions

**Analysis Date:** 2026-01-21

## Naming Patterns

**Files:**
- kebab-case for file names: `rew-client.ts`, `rew-text.ts`, `api-connect.ts`
- Descriptive names reflecting purpose: `base64-decoder.ts`, `measurement.ts`
- Index files use `index.ts` for barrel exports

**Functions:**
- camelCase for all functions: `parseREWExport()`, `calculateQuickStats()`, `executeIngest()`
- Verb-first naming for executable functions: `generateETC()`, `buildSchroederCurve()`, `detectReflections()`
- Verb-first for tool handlers: `executeIngest()`, `executeCompare()`, `executeDecay()`
- Utility functions explicit in purpose: `findDirectSound()`, `estimateT60AtFrequency()`, `classifyDecaySeverity()`

**Variables:**
- camelCase for all variables and constants: `schroeder`, `sampleRate`, `frequencyHz`
- Descriptive names with units when applicable: `sampleRate_hz`, `time_ms`, `energy_db`, `level_db`
- Plural for arrays: `frequencies`, `samples`, `reflections`
- Prefixes for specific types: `is*` for booleans (`isFinite`, `isValidREWBase64`)

**Types:**
- PascalCase for interfaces: `ImpulseResponseData`, `FrequencyResponseData`, `StoredMeasurement`
- PascalCase for type unions: `SpeakerId`, `DecayCharacter`, `Severity`, `ConfidenceLevel`
- Descriptive interface names reflecting data structure: `RT60Result`, `SchroederCurve`, `EarlyReflection`

## Code Style

**Formatting:**
- No explicit formatter configured (ESLint handles basic formatting)
- 2-space indentation (inferred from tsconfig and codebase)
- Line length: No hard limit enforced, but code is concise and readable

**Linting:**
- Tool: ESLint with TypeScript plugin
- Config: `.eslintrc.json`
- Key rules:
  - `@typescript-eslint/explicit-function-return-type: warn` - All functions should declare return types
  - `@typescript-eslint/no-unused-vars: error` with `argsIgnorePattern: "^_"` - Unused variables error, prefix with `_` to suppress
  - `@typescript-eslint/no-explicit-any: warn` - Avoid `any` type (warning, not hard error)
  - `no-console: warn` with `allow: ["error", "warn"]` - Only `console.error()` and `console.warn()` allowed
  - `prefer-const: error` - Always use `const` unless reassignment is needed
  - `eqeqeq: error` - Strict equality only (`===`, `!==`)

## Import Organization

**Order:**
1. Built-in Node modules (never used, this is Node MCP server)
2. Third-party packages: `import { z } from 'zod'`, `import { Server } from '@modelcontextprotocol/sdk/...'`
3. Type imports: `import type { ... } from '...'`
4. Relative imports with `.js` extension: `import { parseREWExport } from '../parser/index.js'`

**Path Aliases:**
- Not configured in tsconfig
- Use relative paths with explicit `.js` extensions for ES modules: `'../types/index.js'`, `'./rew-client.js'`

**Barrel Files:**
- Index files re-export public APIs: `export * from './rew-client.js'`, `export * from './base64-decoder.js'`
- Used in `src/api/index.ts`, `src/parser/index.ts`, `src/analysis/index.ts`

## Error Handling

**Patterns:**
- Input validation via Zod schemas before function execution
- Try-catch blocks at tool execution boundaries (see `executeIngest`, `executeCompare`)
- Zod error detection: `if (error instanceof z.ZodError)` with formatted validation output
- Generic error fallback: `error instanceof Error ? error.message : 'Unknown error occurred'`
- Tool responses use standardized error format with `status: 'error'`, `error_type`, `message`, and optional `suggestion`

**Example from `src/tools/ingest.ts`:**
```typescript
export async function executeIngest(input: IngestInput): Promise<ToolResponse<IngestResult>> {
  try {
    const validated = IngestInputSchema.parse(input);
    // ... processing
    return {
      status: 'success',
      data: { /* result */ }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: 'error',
        error_type: 'validation_error',
        message: 'Input validation failed',
        details: error.errors
      };
    }
    return {
      status: 'error',
      error_type: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
```

## Logging

**Framework:** Native `console` object

**Patterns:**
- `console.error()` for errors and startup messages: `console.error('[MCP Error]', error)`, `console.error('Fatal error starting server:')`
- `console.warn()` permitted by ESLint config
- Server startup status: `console.error('REW MCP Server running on stdio')`
- No info/debug logging (only error/warn allowed)

## Comments

**When to Comment:**
- Function purposes are described in JSDoc blocks
- Complex algorithms document their approach and standards compliance
- Non-obvious mathematical operations (decay calculations, filter coefficients)
- ISO standard references included for acoustic calculations

**JSDoc/TSDoc:**
- Used on all exported functions and types
- Format: `/** * Description */` with parameter types and return types
- Standards references included: ISO 3382-1, ISO 3382-2 for decay analysis
- Example from `src/analysis/decay.ts`:
```typescript
/**
 * Calculate EDT (Early Decay Time) per ISO 3382-1:2009
 *
 * Measures slope from 0 dB to -10 dB on the Schroeder curve,
 * then extrapolates by factor of 6 to estimate 60 dB decay time.
 *
 * ISO 3382 Reference: EDT is derived from the initial 10 dB of decay
 * and is more sensitive to early reflections than T20/T30.
 */
export function calculateEDT(schroeder: SchroederCurve): number | null {
```

## Function Design

**Size:**
- Small, focused functions: 10-50 lines typical
- Single responsibility principle enforced
- Helper functions extracted for complex logic

**Parameters:**
- Named parameters with explicit types: `calculateRegressionLine(time_ms, energy_db, startDb, endDb)`
- Optional parameters marked with `?`: `mic_position_id?: string`
- Default parameters used: `calculateRT60Bands(..., resolution: 'third_octave' = 'third_octave')`
- Destructured options for complex parameters (see `SchroederCurve` type usage)

**Return Values:**
- Always declare explicit return types (enforced by ESLint warn)
- Union types for optional returns: `number | null` for measurements that may fail
- Structured returns with multiple values: Return objects with named fields rather than tuples
- Example: `RT60Result` interface with `t20_seconds`, `t30_seconds`, `confidence`, etc.

## Module Design

**Exports:**
- Named exports for all public APIs: `export function parseREWExport()`, `export interface StoredMeasurement`
- Default exports not used
- Export both implementations and types: `export const measurementStore = new MeasurementStore()`

**Barrel Files:**
- `src/api/index.ts`: Re-exports from `base64-decoder.js` and `rew-client.js`
- `src/parser/index.ts`: Re-exports from `rew-text.js`
- `src/analysis/index.ts`: Re-exports all analysis functions
- `src/types/index.ts`: Central location for all type definitions
- Used to simplify imports: `import { parseREWExport } from '../parser/index.js'`

---

*Convention analysis: 2026-01-21*
