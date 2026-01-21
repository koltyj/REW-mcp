---
phase: 01-core-api-mcp-validation
plan: 01
subsystem: api
tags: [error-handling, typescript, msw, typed-errors]

# Dependency graph
requires:
  - phase: 00-project-init
    provides: Initial codebase structure with REW API client
provides:
  - Typed error handling system with REWApiError class
  - Discriminated error codes for API failures
  - Structured error propagation through tool layer
  - MSW testing infrastructure
affects: [01-core-api-mcp-validation, 02-measurement-retrieval, 03-measurement-interpretation, 04-measurement-workflow]

# Tech tracking
tech-stack:
  added: [msw@^2.6.0]
  patterns: [throw-based-error-handling, discriminated-union-error-codes, suggestion-mapping]

key-files:
  created:
    - src/api/rew-api-error.ts
  modified:
    - src/api/rew-client.ts
    - src/tools/api-get-measurement.ts
    - src/tools/api-list-measurements.ts
    - src/tools/api-measure.ts
    - src/tools/api-measure-workflow.ts
    - src/tools/api-audio.ts
    - src/tools/api-generator.ts
    - src/tools/api-spl-meter.ts

key-decisions:
  - "Use throw-based error handling instead of null returns for type safety"
  - "Discriminated error codes allow tools to provide context-specific suggestions"
  - "Centralized handleResponseError method ensures consistent error mapping"

patterns-established:
  - "API client methods throw REWApiError on failure (no null returns)"
  - "Tool handlers catch REWApiError and map codes to user suggestions"
  - "Error codes: NOT_FOUND, CONNECTION_REFUSED, TIMEOUT, INTERNAL_ERROR, INVALID_RESPONSE"

# Metrics
duration: 7min
completed: 2026-01-21
---

# Phase 1 Plan 1: API Error Handling Refactor Summary

**Replaced null returns with typed REWApiError throws across 22 API client methods, enabling tools to distinguish connection failures from 404s and provide actionable suggestions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-21T20:50:59Z
- **Completed:** 2026-01-21T20:58:17Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Created REWApiError class with 5 discriminated error codes for precise error handling
- Refactored all 22 null-returning API client methods to throw typed errors
- Updated all 7 API tool handlers to catch REWApiError and provide user-friendly suggestions
- Installed MSW for future API testing infrastructure
- All existing tests pass, TypeScript compiles without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add MSW dependency and create REWApiError class** - `5d0418f` (chore)
2. **Task 2: Refactor API client methods to throw REWApiError** - `107bf18` (refactor)
3. **Task 3: Update all tool handlers to catch REWApiError** - `f5b8acc` (feat)

_No metadata commit needed - planning docs tracked separately_

## Files Created/Modified

**Created:**
- `src/api/rew-api-error.ts` - REWApiError class with discriminated error codes (NOT_FOUND, CONNECTION_REFUSED, TIMEOUT, INTERNAL_ERROR, INVALID_RESPONSE)

**Modified:**
- `src/api/rew-client.ts` - Added handleResponseError helper, removed 22 null returns, updated return types
- `src/tools/api-get-measurement.ts` - Added REWApiError catch with suggestion mapping
- `src/tools/api-list-measurements.ts` - Added REWApiError catch with suggestion mapping
- `src/tools/api-measure.ts` - Added REWApiError catch with suggestion mapping
- `src/tools/api-measure-workflow.ts` - Added REWApiError catch with suggestion mapping
- `src/tools/api-audio.ts` - Added REWApiError catch with suggestion mapping
- `src/tools/api-generator.ts` - Added REWApiError catch with suggestion mapping
- `src/tools/api-spl-meter.ts` - Added REWApiError catch with suggestion mapping
- `package.json` - Added msw@^2.6.0 as devDependency

## Decisions Made

**1. Throw-based error handling over null returns**
- Rationale: TypeScript can enforce error handling via try/catch, whereas null checks are optional and easily forgotten. Throwing errors also provides better stack traces for debugging.

**2. Discriminated error codes over HTTP status only**
- Rationale: Error codes like NOT_FOUND and CONNECTION_REFUSED provide semantic meaning that tools can use to offer specific suggestions (e.g., "Use rew.api_list_measurements" for NOT_FOUND vs "Check if REW is running" for CONNECTION_REFUSED).

**3. Centralized handleResponseError helper**
- Rationale: Single method ensures consistent error mapping across all 22 API methods. Reduces duplication and makes future error code additions trivial.

**4. Preserved connect() method's special handling**
- Rationale: Connection establishment requires returning ConnectionStatus with error_message field, not throwing. This is correct behavior per plan specification.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without obstacles.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for next plan:**
- API client error handling is now type-safe and testable
- Tools provide actionable error suggestions to users
- MSW infrastructure ready for integration tests

**Blockers/Concerns:**
- None - foundation for Plan 02 (Integration Tests) is complete

---
*Phase: 01-core-api-mcp-validation*
*Completed: 2026-01-21*
