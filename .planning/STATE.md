# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-21)

**Core value:** Claude can autonomously measure, interpret, and guide fixes for room acoustics — turning raw frequency response data into actionable placement and treatment recommendations.
**Current focus:** Phase 3 - Calibration & Setup Tools

## Current Position

Phase: 3 of 8 (Calibration & Setup Tools) — In progress
Plan: 3 of 7 in current phase
Status: In progress
Last activity: 2026-01-21 — Completed 03-02-PLAN.md

Progress: [██████████] 100% (Phase 1: 4/4 plans)
Progress: [██████████] 100% (Phase 2: 5/5 plans)
Progress: [████░░░░░░] 43% (Phase 3: 3/7 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 5.3 min
- Total execution time: 1.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (Core API + MCP Validation) | 4 | 25 min | 6.25 min |
| 2 (Testing Infrastructure) | 5 | 33 min | 6.6 min |
| 3 (Calibration & Setup Tools) | 3 | 6 min | 2.0 min |

**Recent Trend:**
- Last 5 plans: 8m (02-05), 1m (03-01), 3m (03-02), 2m (03-03)
- Trend: Calibration tools faster than testing (simple composition of existing APIs)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Validate foundation before features (Can't build calibration workflow on untested code)
- Two-milestone structure (Clean separation: working server → intelligent assistant)
- REW as measurement engine (Industry standard with API)
- Plain language interpretation (Users need "what's wrong and why" not just graphs)
- **01-01:** Use throw-based error handling instead of null returns for type safety
- **01-01:** Discriminated error codes allow tools to provide context-specific suggestions
- **01-01:** Centralized handleResponseError method ensures consistent error mapping
- **01-02:** Use MSW for HTTP-level mocking instead of function mocks for realistic API testing
- **01-02:** Test error propagation via REWApiError with discriminated codes
- **01-02:** Use encodeREWFloatArray helper for big-endian float encoding in test fixtures
- **01-03:** Use InMemoryTransport.createLinkedPair() for MCP client/server testing
- **01-03:** Generate REW text format strings for ingest tool tests (not direct JSON)
- **01-03:** Accept module-level activeClient persistence across tests (design limitation)
- **01-03:** Use MSW with onUnhandledRequest: warn for flexible test isolation
- **01-04:** URL encoding verification for smoothing parameters (1/3 → 1%2F3)
- **01-04:** Test realistic array sizes (4096 points) to match typical REW measurements
- **01-04:** Validate empty response edge case for graceful degradation
- **02-01:** Start coverage thresholds below current levels (45%) to prevent immediate CI failures
- **02-01:** Use vitest-coverage-report-action instead of codecov for better PR integration
- **02-01:** Test European decimal format via parseFrequencyResponse (public API) not internal parseNumber
- **02-02:** Use .passthrough() on Zod schemas to allow additional API fields for forward compatibility
- **02-02:** REWClientLike as interface not Zod schema (internal implementation, not API data)
- **02-02:** validateApiResponse for critical data, safeParse for optional data
- **02-03:** Use toBeCloseTo for float comparisons to handle encoding precision
- **02-03:** Test MCP tools via schema validation, not full MSW integration (simpler, faster)
- **02-03:** Set coverage thresholds 2-3% below actual for normal fluctuation buffer
- **02-04:** Use vi.mock for getActiveApiClient instead of MSW (unit-level testing)
- **02-04:** Test each action branch independently with focused mocks
- **02-04:** Mock individual REWClient methods for precise control over test scenarios
- **02-05:** Use vi.useFakeTimers for testing setTimeout operations (calibrate_level, measure_sequence)
- **02-05:** Test Pro license detection via both 403 status and 'pro' keyword in response data
- **02-05:** Test workflow helpers with realistic device detection keywords (umik, earthworks, dayton, minidsp)
- **03-01:** Return null from getInputLevels on validation failure for graceful degradation
- **03-01:** Transform API response field names (rms -> rms_levels) for internal consistency
- **03-01:** Accept both 200 and 202 status codes for async REW API commands
- **03-02:** Zone-based classification prioritizes clipping detection first (peak > -3 dBFS before RMS checks)
- **03-02:** Block measurements for clipping and very low zones (safety + quality)
- **03-02:** Default target -12 dBFS RMS for measurement level checking
- **03-02:** L/R channel imbalance threshold 3 dB (industry standard for balanced stereo)
- **03-03:** Use start/check/stop pattern for semi-automated workflows requiring user interaction
- **03-03:** Include stabilization delays (2s for generator, 1s for SPL meter) for accurate readings
- **03-03:** Generate user-friendly guidance messages with specific dB adjustment recommendations
- **03-03:** Default to C-weighting and 85 dB target (broadcast reference standard)

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1-2 (Foundation):**
- ~~Silent API failures are highest-risk pitfall~~ (RESOLVED in 01-01: typed error handling implemented)
- ~~Zero integration tests in current codebase~~ (RESOLVED in 01-02: API client tests with MSW)
- ~~MCP specification violation from unused capabilities~~ (VERIFIED in 01-03: server does not declare resources/prompts capabilities)

**Phase 4 (Measurement Workflow):**
- Research flag: REW API measurement triggering capability unverified
- Session state persistence mechanism needs design during planning

**Phase 7 (Optimization Guidance):**
- Research flag: Room dimensions input method (elicitation vs. manual)

## Session Continuity

Last session: 2026-01-21 23:33 UTC
Stopped at: Completed 03-02-PLAN.md
Resume file: None
