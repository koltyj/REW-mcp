# Phase 2: Testing Infrastructure - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprehensive test coverage with integration tests, parser robustness for edge cases (European decimal formats), and type safety through Zod validation. Extends Phase 1's testing foundation to meet coverage targets and eliminate `any` types.

</domain>

<decisions>
## Implementation Decisions

### Coverage strategy
- Error handling paths and parsing logic require 100% coverage (both are critical paths)
- API client 80% and tool handlers 70% are the overall targets
- Coverage reporting: terminal summary only (minimal noise)
- Coverage ratchet: CI fails if coverage drops from previous commit

### European decimal handling
- Error messages must be locale-aware: "Failed to parse '1,5' — detected comma decimal format"
- Claude decides which locales to test and test data sources based on realistic REW usage
- Claude decides which edge cases beyond comma separators are relevant

### Zod validation scope
- Validate both tool inputs (from Claude) AND API responses (defense in depth)
- Validation errors must be Claude-friendly: "REW returned unexpected data format for measurement X" — actionable, not raw Zod errors
- Claude decides which responses need Zod validation and schema strictness for unknown fields

### CI integration
- Coverage ratchet enforced (can only increase)
- Test failures reported both inline in logs AND as GitHub PR annotations
- Claude decides test timeout policy and whether integration tests run in CI

### Claude's Discretion
- Hard fail vs warning for coverage thresholds
- Branch coverage vs line coverage only
- Which locales to test (German, French, Swedish, etc.)
- Test data sources (synthetic, real REW exports, or both)
- Which decimal edge cases beyond comma separators
- Which API responses need Zod validation
- Zod schema strictness (strict/lenient/passthrough)
- Test timeout policy (per-test vs suite-level)
- Whether integration tests run in CI

</decisions>

<specifics>
## Specific Ideas

- Locale-aware error messages should help diagnose decimal parsing issues without exposing raw technical errors
- Coverage ratchet prevents backsliding — discipline over flexibility
- Defense in depth with validation at tool boundary (inputs from Claude) and API boundary (responses from REW)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-testing-infrastructure*
*Context gathered: 2026-01-21*
