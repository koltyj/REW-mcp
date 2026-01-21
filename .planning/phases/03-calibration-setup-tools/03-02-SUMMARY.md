---
phase: 03-calibration-setup-tools
plan: 02
subsystem: api
tags: [rew-api, input-levels, calibration, zod]

# Dependency graph
requires:
  - phase: 03-01
    provides: SPL calibration tool and level monitoring foundation
provides:
  - Input level checking MCP tool (rew.api_check_levels)
  - Zone-based feedback system (Clipping, Hot, Optimal, Low, Very Low)
  - Mic gain adjustment guidance with dB calculations
  - L/R channel imbalance detection
affects: [03-03, 03-04, 04-measurement-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Zone-based level classification with blocking conditions
    - Feedback generation with target-based recommendations
    - Channel imbalance detection (>3 dB difference)

key-files:
  created:
    - src/tools/api-check-levels.ts
  modified:
    - src/tools/index.ts

key-decisions:
  - "Use zone-based classification for clear user feedback (CLIPPING > VERY_LOW priority)"
  - "Block measurements for clipping and very low zones (safety + quality)"
  - "Default target -12 dBFS RMS (standard measurement level)"
  - "Include optional warning field in feedback for channel mismatch"

patterns-established:
  - "Zone determination prioritizes clipping detection first (safety)"
  - "Feedback includes both status and actionable recommendation"
  - "Always cleanup monitoring in finally block"

# Metrics
duration: 3min
completed: 2026-01-21
---

# Phase 03 Plan 02: API Check Levels Summary

**Zone-based input level checking with dB-precise mic gain guidance and measurement blocking for unsafe conditions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-21T23:31:07Z
- **Completed:** 2026-01-21T23:33:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created rew.api_check_levels MCP tool for mic gain calibration
- Implemented 5-zone level classification (Clipping, Hot, Optimal, Low, Very Low)
- Measurement blocking for clipping (>-3 dBFS peak) and very low (<-40 dBFS RMS) conditions
- L/R channel imbalance detection with warnings for >3 dB difference
- dB-precise adjustment recommendations relative to target

## Task Commits

Each task was committed atomically:

1. **Task 1: Create api-check-levels.ts tool** - `f6e7992` (feat)
2. **Task 2: Register api-check-levels tool in index.ts** - `04e950e` (feat)

## Files Created/Modified
- `src/tools/api-check-levels.ts` - Input level checking with zone-based feedback and guidance
- `src/tools/index.ts` - Tool registration for rew.api_check_levels

## Decisions Made

**Zone priority ordering:** Clipping detection takes priority over RMS zones for safety (peak > -3 dBFS checked first).

**Blocking conditions:** Measurements blocked for CLIPPING and VERY_LOW zones to prevent distorted or noisy measurements (SETV-02, SETV-03).

**Feedback structure:** Status + recommendation + optional warning pattern for clear user guidance.

**Channel imbalance threshold:** 3 dB difference between L/R triggers warning (industry standard for balanced stereo).

**Optional warning field:** Added warning as optional field in feedback return type rather than generateFeedback return type to allow mismatch detection to be added separately.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript error on feedback.warning assignment:** Initial implementation had generateFeedback return type without optional warning field. Fixed by adding `warning?: string` to return type signature.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Input level checking complete. Ready for:
- Plan 03-03: Full measurement workflow integration
- Plan 03-04: Multi-position measurement sequences
- Plan 04: Automated measurement orchestration

L/R channel imbalance detection provides foundation for stereo measurement workflows.

---
*Phase: 03-calibration-setup-tools*
*Completed: 2026-01-21*
