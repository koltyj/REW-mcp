# Codebase Concerns

**Analysis Date:** 2026-01-21

## Tech Debt

**Type Safety: Excessive `any` Type Usage**
- Issue: Multiple methods use `any` type instead of proper type definitions, bypassing TypeScript's type safety guarantees
- Files:
  - `src/api/rew-client.ts` (lines 77, 104, 336, 581, 665, 705, 853, 1020)
  - `src/tools/api-measure-workflow.ts` (lines 183, 246, 321, 369, 430, 538)
  - `src/tools/api-measure.ts` (line 117)
  - `src/tools/api-audio.ts` (line 42)
  - `src/tools/index.ts` (lines 153, 157, 161, 165, 169, 173, 177, 181, 185, 189, 193, 197, 201, 205, 209, 213, 217)
- Impact: Silent type errors at runtime, harder to refactor, reduces IDE autocomplete assistance, makes bugs harder to catch during development
- Fix approach: Replace `any` with proper union types or generic type parameters. For example, in `rew-client.ts`, create specific types for API response payloads instead of `data?: any`

**Silent Null Returns from API Methods**
- Issue: REW API client methods return `null` on any error without distinguishing between different failure modes (connection error, 404, timeout, malformed response)
- Files: `src/api/rew-client.ts` (lines 333, 353, 396, 440, 487, 526, 567, 604, 628, 644, 668, 692, 708, 727, 738, 749, 760, 771, 792, 803)
- Impact: Caller cannot determine why a request failed or what recovery action to take. Difficult to debug integration issues with REW API
- Fix approach: Create a `Result<T, Error>` type or use discriminated unions to distinguish success/failure cases. Return error details including HTTP status and response body

**Function Naming: Misnomer in Decay Analysis**
- Issue: Function `generateETC()` actually calculates the Schroeder integral (backward-integrated energy), not the Energy Time Curve (ETC)
- Files: `src/analysis/decay.ts` (lines 70-88)
- Impact: Code comments acknowledge this is "kept for backward compatibility," but this creates ongoing confusion for maintainers and API consumers
- Fix approach: Either rename to `calculateSchroederIntegral()` with proper deprecation, or maintain both names with one calling the other

## Known Bugs

**Empty Tool Array Returned Without Warning**
- Symptoms: `listMeasurements()` silently returns `[]` when the `/measurements` endpoint returns non-200 status
- Files: `src/api/rew-client.ts` (line 333)
- Trigger: REW API connection established but `/measurements` endpoint unreachable (e.g., permission issue, endpoint missing in older REW versions)
- Workaround: Caller must check if returned array is empty and make separate `connect()` call to determine if it's a real "no measurements" state or an error

**Missing Deep Validation in API Responses**
- Symptoms: If REW API returns unexpected JSON structure, code assumes field presence without validation
- Files: `src/api/rew-client.ts` (lines 336-342 in `listMeasurements()`, lines 356-365 in `getMeasurement()`)
- Trigger: REW version mismatch or API specification change
- Workaround: Catches at runtime when accessing undefined properties. No schema validation of response before processing

## Security Considerations

**Hardcoded Localhost Default Without Explicit Documentation**
- Risk: API client defaults to `127.0.0.1:4735` without clear documentation that this is localhost-only and production must reconfigure
- Files: `src/api/rew-client.ts` (lines 91-92), `src/tools/api-connect.ts` (line 18)
- Current mitigation: Default is localhost by design (REW API is not intended for remote access). Documentation exists in function comments
- Recommendations: Add explicit validation that disallows non-localhost addresses by default with clear override mechanism. Document this security boundary in README

**No Input Validation on File Content**
- Risk: Parser accepts arbitrary file content, could fail ungracefully on malformed input
- Files: `src/parser/rew-text.ts` (lines 120-164 for frequency response parsing)
- Current mitigation: Function checks for minimum 10 data points (line 169), validates numeric ranges (lines 157-158)
- Recommendations: Add maximum file size limit to prevent memory exhaustion from extremely large exports. Add explicit validation of delimiter format before parsing

## Performance Bottlenecks

**Nested Loop Complexity in Averaging**
- Problem: Multiple nested loops iterate over measurement frequencies and measurements list
- Files: `src/analysis/averaging.ts` (lines 222-230 for RMS averaging, lines 279-286 for vector averaging)
- Cause: For each common frequency, iterates through all measurements to calculate weighted average. No caching of resampled frequency arrays
- Impact: O(n*m) where n = frequency points (~1000), m = measurements (typically 2-10). Acceptable for current use, but becomes slow with 50+ measurements
- Improvement path: Precompute interpolation tables once, reuse for all frequency calculations. Cache frequency alignment results

**Linear Search for Frequency Alignment**
- Problem: `findFrequencyIndex()` uses linear search to find corresponding frequency indices across measurements
- Files: `src/analysis/averaging.ts` (lines 128-155)
- Cause: Implements bisection-based search with fallback to linear scan, but starts from beginning each time
- Impact: O(m*n*log(n)) for m measurements. Slow for many measurements
- Improvement path: Use binary search exclusively since frequency arrays are always sorted. Cache bisection results

**Unoptimized Array Slicing in Decay Analysis**
- Problem: `generateETC()` creates copy of entire samples array then creates energy array copy
- Files: `src/analysis/decay.ts` (lines 77-87)
- Cause: `samples.slice()` creates unnecessary copy before squaring and accumulating
- Impact: Memory overhead for large impulse responses (typically 48kHz * 2-5 seconds = 96k-240k floats)
- Improvement path: Calculate Schroeder integral in single pass without intermediate array copies

## Fragile Areas

**REW API Client: Tightly Coupled to Undocumented Endpoints**
- Files: `src/api/rew-client.ts`
- Why fragile:
  - Depends on `/doc.json` endpoint for health check (line 171), but REW docs don't explicitly guarantee this endpoint exists in all versions
  - Multiple endpoints return inconsistently structured JSON (line 336 maps `m.uuid || m.id`, suggesting API is unstable)
  - Comments note "The /application endpoint may not exist in all REW versions" (line 164), indicating past breaking changes
- Safe modification: When adding new API calls, wrap in version detection. Check REW version first via `/doc.json` schema inspection
- Test coverage: No unit tests for `REWApiClient` itself; all testing is through integration tests in tool layer

**Decay Analysis: Complex Mathematical Edge Cases**
- Files: `src/analysis/decay.ts`
- Why fragile:
  - `calculateTopt()` has multiple fallback returns if validation fails (lines 302-323), making function behavior hard to predict
  - Parallel fallback logic: uses T30 as fallback, then checks if result is in "reasonable range" (lines 321-322)
  - Noise floor estimation uses hard-coded 10% tail assumption (line 335), may be invalid for short impulse responses
- Safe modification: When changing T20/T30/EDT/Topt logic, add explicit test cases for edge conditions: very short IR, high noise floor, no decay range
- Test coverage: `src/analysis/decay.test.ts` (293 lines) covers basic cases but lacks edge case tests for fallback paths

**Measurement Averaging: Frequency Alignment Assumptions**
- Files: `src/analysis/averaging.ts`
- Why fragile:
  - Assumes all measurements have overlapping frequency ranges (line 106 filters to overlap)
  - Frequency matching uses 1% tolerance (line 106: `f <= maxFreq * 1.01`), which could fail for measurements from different REW export resolutions
  - Vector (coherent) averaging depends on phase data which may be missing or invalid (line 272)
- Safe modification: Before calling average functions, validate all measurements have consistent frequency resolution. Add explicit error if frequency ranges don't overlap sufficiently
- Test coverage: `src/analysis/averaging.test.ts` (219 lines) tests basic averaging but lacks tests for misaligned frequency grids

**Tool Handler: All Tools Use `as any` Cast**
- Files: `src/tools/index.ts` (lines 153-217)
- Why fragile: Every tool invocation bypasses type checking with `args as any`, so schema validation is the only defense
- Safe modification: Create union type of all tool input types instead of casting to `any`. Zod will still validate, but TypeScript can catch wrong tool handler mappings
- Test coverage: Tools are not tested in isolation; each must be tested through the full MCP server

## Scaling Limits

**In-Memory Measurement Storage**
- Current capacity: Stores all ingested measurements in memory per session (no persistence layer)
- Limit: Each measurement stores full frequency response (typically 1-2 KB per point * 1000 points = 1-2 MB) plus impulse response samples
- Scaling path:
  1. Implement file-based cache for measurements (SQLite or JSON file per measurement)
  2. Add LRU cache to keep only recent measurements in memory
  3. Stream large arrays instead of buffering entirely

**API Request Queuing**
- Current capacity: No request queuing or rate limiting against REW API
- Limit: If multiple tools make concurrent API calls and REW is slow, requests may timeout or fail unpredictably
- Scaling path: Implement request queue with exponential backoff for 503/timeout errors. Add configurable timeout per request type

## Dependencies at Risk

**@modelcontextprotocol/sdk@1.25.2**
- Risk: MCP protocol is evolving; this version pins to specific protocol features that may change
- Impact: If protocol breaking changes occur, this server will need updates
- Migration plan: Monitor MCP releases, add version check in tool handler to detect protocol mismatches. Document minimum SDK version required

**zod@3.23.8**
- Risk: Input schema validation is critical; any bug in Zod could bypass validation
- Current mitigation: All tool inputs are validated via Zod schemas before execution
- Migration plan: Keep Zod up-to-date. Test schema changes carefully before deploying

## Test Coverage Gaps

**No Tests for API Client Layer**
- What's not tested: `src/api/rew-client.ts` (1061 lines) has no unit tests
- Files: `src/api/rew-client.ts`, `src/api/base64-decoder.ts`
- Risk: Breaking changes to HTTP request/response handling go undetected until end-to-end tool testing
- Priority: High - API client is the most fragile component and most likely to break on REW updates

**No Tests for Tool Handler Dispatch**
- What's not tested: `src/tools/index.ts` tool registration and handler matching
- Files: `src/tools/index.ts` (249 lines)
- Risk: New tools added to server but not registered in handler, or wrong tool invoked
- Priority: Medium - caught immediately when testing tools through MCP, but makes CI fragile

**No Tests for Tool Integration Functions**
- What's not tested: None of the tool layer functions have unit tests
- Files: All of `src/tools/` except `ingest.ts`, `compare.ts`, `room-modes.ts`, `decay.ts`, `impulse.ts`, `glm-interpret.ts`, `averaging.ts`, `sub-integration.ts`
  - `api-audio.ts` (6222 lines) - No tests
  - `api-connect.ts` (3839 lines) - No tests
  - `api-generator.ts` (6718 lines) - No tests
  - `api-get-measurement.ts` (6749 lines) - No tests
  - `api-list-measurements.ts` (2596 lines) - No tests
  - `api-measure-workflow.ts` (18369 lines) - No tests
  - `api-measure.ts` (7667 lines) - No tests
  - `api-spl-meter.ts` (5482 lines) - No tests
  - `target-compare.ts` (8224 lines) - No tests
  - `impulse.ts` (9645 lines) - No tests
  - `compare.ts` (8775 lines) - No tests
- Risk: All API-facing tools can fail silently or produce incorrect output without being caught by tests
- Priority: High - these are user-facing tools with no coverage

**Missing Edge Case Tests for Parsing**
- What's not tested: Error cases in REW text parser
- Files: `src/parser/rew-text.ts` (413 lines)
- Risk: Malformed file inputs may cause parser to hang or crash
- Priority: Medium - mostly defensive, but important for robustness

**Missing Integration Tests for Analysis Functions**
- What's not tested: Analysis functions with real REW export data
- Files: Analysis layer has tests for individual functions but not with actual REW data
- Risk: Assumptions about data structure may not match real exports from different REW versions
- Priority: Medium - would catch compatibility issues early

## Missing Critical Features

**Error Recovery in Workflow Orchestration**
- Problem: `api-measure-workflow.ts` executes multi-step workflows (setup → calibrate → measure) but has no rollback or cleanup on failure
- Blocks: If calibration fails halfway, state is left in unknown condition for next attempt
- Recommendation: Add cleanup handler, implement idempotent operations for measurement setup

**Version Detection for REW API Compatibility**
- Problem: No mechanism to detect REW version and adjust API calls accordingly
- Blocks: When REW API changes, server doesn't know which endpoints are safe to call
- Recommendation: Query `/doc.json` on first connect, parse OpenAPI spec to detect available endpoints

**Asynchronous Measurement Support**
- Problem: Code detects async measurements (HTTP 202 response) but doesn't poll for completion
- Files: `src/api/rew-client.ts` (line 593), `src/tools/api-measure.ts`
- Blocks: Cannot use REW in non-blocking mode reliably
- Recommendation: Implement polling loop with configurable timeout for 202 responses

**Request Timeout Configuration Per Tool**
- Problem: All API requests use fixed 10s timeout from client config
- Blocks: Some long operations (measurement sweep) may need longer timeout than others
- Recommendation: Add per-tool timeout overrides in tool input schemas

---

*Concerns audit: 2026-01-21*
