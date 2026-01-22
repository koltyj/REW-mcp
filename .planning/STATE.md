# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-21)

**Core value:** Claude can autonomously measure, interpret, and guide fixes for room acoustics — turning raw frequency response data into actionable placement and treatment recommendations.
**Current focus:** Phase 7 - Optimization Guidance

## Current Position

Phase: 7 of 8 (Optimization Guidance) — Complete
Plan: 4 of 4 in current phase
Status: Phase verified
Last activity: 2026-01-22 — Completed 07-04-PLAN.md (Unit Tests)

Progress: [██████████] 100% (Phase 1: 4/4 plans)
Progress: [██████████] 100% (Phase 2: 5/5 plans)
Progress: [██████████] 100% (Phase 3: 4/4 plans)
Progress: [██████████] 100% (Phase 4: 4/4 plans)
Progress: [██████████] 100% (Phase 5: 4/4 plans)
Progress: [██████████] 100% (Phase 6: 3/3 plans)
Progress: [██████████] 100% (Phase 7: 4/4 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 28
- Average duration: 3.6 min
- Total execution time: 1.78 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (Core API + MCP Validation) | 4 | 25 min | 6.25 min |
| 2 (Testing Infrastructure) | 5 | 33 min | 6.6 min |
| 3 (Calibration & Setup Tools) | 4 | 13 min | 3.25 min |
| 4 (Measurement Workflow + Sessions) | 4 | 12.5 min | 3.1 min |
| 5 (Analysis & Interpretation) | 4 | 23 min | 5.75 min |
| 6 (GLM Transparency) | 3 | 10 min | 3.3 min |
| 7 (Optimization Guidance) | 4 | 21 min | 5.25 min |

**Recent Trend:**
- Phase 7 complete (Optimization Guidance)
- 4 plans executed in 21 min total
- Recent average: 5.25 min per plan (Phase 7)

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
- **03-04:** Test zone boundaries at exact thresholds (-3, -10, -20, -40 dBFS)
- **03-04:** Use vi.advanceTimersByTimeAsync for async setTimeout testing
- **03-04:** Test channel mismatch at exactly 3 dB (industry standard)
- **04-01:** Use native crypto.randomUUID() instead of external UUID library (Node 14.17+ built-in)
- **04-01:** Map-based module-level storage for in-memory concurrent session isolation
- **04-01:** Clone-and-merge pattern for updateSession to avoid mutation
- **04-01:** Sort listActiveSessions by created_at descending (most recent first) for resume UX
- **04-01:** getSession throws with helpful message suggesting get_status tool
- **04-02:** Use Record<SequenceStep, SequenceStep[]> for type-safe transition table
- **04-02:** Throw errors on invalid transitions with descriptive messages
- **04-02:** Return null from getNextStep when sequence is complete
- **04-03:** Reject session_id on start_session to prevent confusion (must omit for new session)
- **04-03:** Generate measurement names from short session_id (first 8 chars) for traceability
- **04-03:** Enable blocking mode for synchronous measurement completion detection
- **04-03:** Detect new measurement by comparing before/after list counts
- **04-03:** Set sequence_step to 'complete' after subwoofer measurement
- **04-03:** Return active_sessions array when get_status called without session_id
- **04-03:** 403 status mapped to license_error with upgrade URL
- **04-04:** Export clearAllSessions for test isolation (testing-only function)
- **04-04:** Use valid UUIDs in error path tests to bypass Zod validation
- **04-04:** Mock listMeasurements with sequential calls for before/after measurement detection
- **05-01:** Fixability-first scoring: 60% fixability + 40% severity (prioritizes free/effective fixes)
- **05-01:** Fixability weights: placement=100, settings=75, treatment=50, unfixable=10
- **05-01:** Category-based recommendation templates for context-aware guidance
- **05-02:** SBIR classification uses quarter-wavelength formula: distance_ft = 1125 / (4 * frequency_hz)
- **05-02:** SBIR detection constrained to 60-300 Hz range with Q>5 and 1-4 ft distance
- **05-02:** Room modes interpretation optional when dimensions not provided
- **05-03:** L/R symmetry ratings: <1 dB excellent, 1-2 dB good, 2-3 dB fair, >3 dB poor
- **05-03:** Phase inversion detected at 150-210 degrees (near 180°) at crossover
- **05-03:** Imaging impact thresholds: <1 dB level AND <2 dB variance = none, >3 dB = significant
- **05-04:** Unified tool gracefully handles missing optional inputs (omits analysis section)
- **05-04:** Top 5 recommendations selected from combined prioritized issues
- **05-04:** Overall severity determined by worst severity across all analysis sections
- **06-01:** 50%+ reduction = success (proportional threshold prioritizes significant improvements)
- **06-01:** Context-dependent unchanged thresholds: <1/2/3 dB based on issue size
- **06-01:** Overcorrection detection is informational, not warning (preference-dependent)
- **06-01:** Post-only mode confidence = medium (heuristics without baseline comparison)
- **06-02:** GLM comparison always runs (full or heuristic mode) based on parameter presence
- **06-02:** GLM persistent issues mapped to placement fixability for prioritization integration
- **06-02:** Overcorrection indicators included in summary as informational notes, not warnings
- **06-02:** GLM severity contributes to overall severity based on persistent issue count (1/2/3+ thresholds)
- **07-01:** SBIR recommendations use quarter-wavelength formula (1125 / (4 * freq_hz)) for distance estimation
- **07-01:** Sub recommendations include phase/boundary/crossover context per CONTEXT.md requirement
- **07-01:** Listening position uses 38% rule when room dimensions available
- **07-01:** Confidence levels based on issue category (SBIR Q>10 = high, Q>5 = medium)
- **07-01:** Element determination by category (SBIR=monitors, sub_integration=subwoofer, room_modes frequency-dependent)
- **07-02:** Proportional 50%+ threshold for success classification prioritizes significant improvements
- **07-02:** Context-dependent unchanged thresholds (1/2/3 dB) prevent false positives on large vs small issues
- **07-02:** Separate zone evaluations (smoothness/balance/sub) instead of combined score for clarity
- **07-02:** should_stop only when smoothness reaches 'good' - primary metric drives completion
- **07-02:** Worsened threshold at -10% triggers 'try opposite direction' guidance
- **07-03:** One recommendation at a time per CONTEXT.md (scientific approach: suggest, measure, evaluate, then next)
- **07-03:** Multi-action MCP tool pattern with action enum for related workflows
- **07-03:** Element-specific routing: sub_integration → generateSubRecommendation, room_modes → generateListeningPositionRecommendation
- **07-03:** Validation with next_action: improvement_type determines suggested user action
- **07-04:** Test zone thresholds at exact boundaries (3.0/3.1 dB) to verify classification logic
- **07-04:** Use controlled variance patterns in mock frequency responses for predictable testing
- **07-04:** Mock measurementStore.get for tool tests rather than full integration

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1-2 (Foundation):**
- ~~Silent API failures are highest-risk pitfall~~ (RESOLVED in 01-01: typed error handling implemented)
- ~~Zero integration tests in current codebase~~ (RESOLVED in 01-02: API client tests with MSW)
- ~~MCP specification violation from unused capabilities~~ (VERIFIED in 01-03: server does not declare resources/prompts capabilities)

**Phase 4 (Measurement Workflow):**
- ~~Research flag: REW API measurement triggering capability unverified~~ (RESOLVED in 04-03: executeMeasureCommand successfully triggers measurements via REW API)
- ~~Session state persistence mechanism needs design during planning~~ (RESOLVED in 04-01: Map-based module-level storage with session state management)

**Phase 7 (Optimization Guidance):**
- Research flag: Room dimensions input method (elicitation vs. manual)

## Session Continuity

Last session: 2026-01-22 04:18 UTC
Stopped at: Completed 07-04-PLAN.md (Unit Tests)
Resume file: None

**Phase 7 Verified:** All optimization guidance functionality delivered with comprehensive tests (97.43% coverage, 6/6 must-haves verified). Ready for Phase 8 (Workflow Orchestration).
