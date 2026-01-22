---
phase: 07-optimization-guidance
plan: 01
subsystem: interpretation
tags: [optimization, placement, recommendations, physics, sbir, room-modes]

# Dependency graph
requires:
  - phase: 05-analysis-interpretation
    provides: PrioritizedIssue type and interpretation infrastructure
  - phase: 05-analysis-interpretation
    provides: SBIR classification with quarter-wavelength formula
provides:
  - Placement recommendation types with physics-based reasoning
  - Element-specific recommendation generators (monitors, sub, listening position)
  - Confidence-based recommendation system
affects: [08-mcp-tools, optimization-workflow, user-guidance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Physics-based recommendation generation (quarter-wavelength, 38% rule, boundary loading)
    - Element-specific recommendation detail (sub gets more context than monitors)
    - Confidence levels based on issue category and Q factor

key-files:
  created:
    - src/optimization/types.ts
    - src/optimization/recommendations.ts
    - src/optimization/index.ts
  modified: []

key-decisions:
  - "07-01: SBIR recommendations use quarter-wavelength formula (1125 / (4 * freq_hz)) for distance estimation"
  - "07-01: Sub recommendations include phase/boundary/crossover context per CONTEXT.md requirement"
  - "07-01: Listening position uses 38% rule when room dimensions available"
  - "07-01: Confidence levels based on issue category (SBIR Q>10 = high, Q>5 = medium)"
  - "07-01: Element determination by category (SBIR=monitors, sub_integration=subwoofer, room_modes frequency-dependent)"

patterns-established:
  - "Physics-based reasoning in all recommendations (not just 'move speaker')"
  - "Null handling emphasizes repositioning over EQ (can't boost nulls)"
  - "Boundary loading physics explained (+3dB per boundary for corner placement)"

# Metrics
duration: 3min
completed: 2026-01-22
---

# Phase 7 Plan 1: Recommendation Generation Summary

**Physics-based placement recommendations with SBIR quarter-wavelength formula, 38% listening position rule, and element-specific detail for monitors/subwoofer/listening position**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-22T03:52:20Z
- **Completed:** 2026-01-22T03:55:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created optimization type system with PlacementRecommendation and SubRecommendationDetail interfaces
- Implemented physics-based recommendation generation using quarter-wavelength formula for SBIR
- Element-specific recommendation functions with different detail levels (sub gets phase/boundary/crossover context)
- Confidence determination based on issue category and Q factor
- Listening position recommendations with 38% rule when room dimensions available

## Task Commits

Each task was committed atomically:

1. **Task 1: Create optimization types** - `0673664` (feat)
2. **Task 2: Create recommendation generation functions** - `2625024` (feat)

## Files Created/Modified

- `src/optimization/types.ts` - Type definitions for PlacementRecommendation, SubRecommendationDetail, OptimizationElement, RecommendationConfidence
- `src/optimization/recommendations.ts` - Recommendation generation functions with physics-based reasoning
- `src/optimization/index.ts` - Module exports for optimization system

## Decisions Made

**SBIR distance calculation:**
- Used quarter-wavelength formula from classifySBIR: `distance_ft = 1125 / (4 * frequency_hz)`
- Formula calculates boundary distance where reflected path is 1/4 wavelength longer than direct path

**Sub recommendation detail:**
- Phase suggestion included when phase inversion detected (150-210° at crossover)
- Boundary loading context explains +3dB per boundary (corner = +9dB from 3 boundaries)
- Crossover context added for issues in 60-100 Hz range

**Listening position guidance:**
- 38% rule applied when room dimensions available (optimal = 0.38 * room_length from front wall)
- Avoids common modal nulls at 1/4, 1/2, 3/4 room positions
- Without dimensions: generic forward/backward guidance with low confidence

**Element determination:**
- SBIR → monitors (boundary interference from speaker placement)
- sub_integration → subwoofer (phase/level/crossover issues)
- lr_symmetry → monitors (stereo imaging)
- room_modes → frequency-dependent (<80Hz = sub, 80-200Hz = listening position)

**Confidence levels:**
- SBIR with Q>10: high confidence
- SBIR with Q>5: medium confidence
- Room modes with dimensions: medium confidence
- Room modes without dimensions: low confidence

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Linter interference:**
During commit, a linter/formatter overwrote `src/optimization/index.ts` with exports for non-existent validation.ts and success-criteria.ts files. These extra files were deleted and index.ts was restored to the correct implementation exporting only types.ts and recommendations.ts content. Commit was amended to include corrected index.ts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 7 Plan 2:**
- Recommendation generation module complete
- Physics-based reasoning implemented (SBIR, room modes, boundary loading)
- Element-specific recommendation detail established
- Confidence system functional

**For MCP tool integration (Phase 8):**
- PlacementRecommendation interface ready for tool output
- Recommendation functions can be called from unified interpretation tool
- Physics context provides actionable user guidance

**No blockers or concerns.**

---
*Phase: 07-optimization-guidance*
*Completed: 2026-01-22*
