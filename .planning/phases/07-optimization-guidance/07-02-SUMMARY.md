---
phase: 07-optimization-guidance
plan: 02
subsystem: analysis
tags: [validation, success-criteria, optimization, feedback]

# Dependency graph
requires:
  - phase: 05-analysis-interpretation
    provides: "Peak/null detection and quick stats calculation"
  - phase: 06-glm-transparency
    provides: "getUnchangedThreshold logic for context-dependent thresholds"
provides:
  - "validateAdjustment function for pre/post comparison with improvement classification"
  - "evaluateSuccessCriteria function for zone-based progress toward +-3dB target"
  - "Plain language feedback with actionable next steps"
affects: [08-optimization-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zone-based classification (good/acceptable/needs_work) for progressive success criteria"
    - "Context-dependent unchanged thresholds (1/2/3 dB based on issue size)"
    - "Proportional improvement threshold (50%+ = success) vs absolute thresholds"

key-files:
  created:
    - src/optimization/validation.ts
    - src/optimization/success-criteria.ts
  modified:
    - src/optimization/index.ts

key-decisions:
  - "Proportional 50%+ threshold for success classification prioritizes significant improvements"
  - "Context-dependent unchanged thresholds (1/2/3 dB) prevent false positives on large vs small issues"
  - "Separate zone evaluations (smoothness/balance/sub) instead of combined score for clarity"
  - "should_stop only when smoothness reaches 'good' - primary metric drives completion"
  - "Worsened threshold at -10% triggers 'try opposite direction' guidance"

patterns-established:
  - "ValidationResult: Plain language summary + next_action + explanation for user guidance"
  - "SuccessCriteriaResult: Three separate ZoneEvaluation objects (not combined score)"
  - "Zone thresholds: smoothness <=3/<=5, balance <=1/<=2, sub <=4/<=6"

# Metrics
duration: 7min
completed: 2026-01-22
---

# Phase 7 Plan 02: Validation & Success Criteria Summary

**Pre/post validation with 50%+ proportional success threshold and zone-based progress toward +-3dB target**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-22T03:52:21Z
- **Completed:** 2026-01-22T04:00:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- validateAdjustment classifies improvements with proportional (50%+) and context-dependent thresholds
- evaluateSuccessCriteria returns separate zone evaluations for smoothness, L/R balance, and sub integration
- Plain language summaries include both dB and percentage with actionable next steps
- Worsened adjustments (<-10%) trigger "try opposite direction" guidance

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validation module** - `7b11f27` (feat)
2. **Task 2: Create success criteria module** - `80878c0` (feat)

## Files Created/Modified

- `src/optimization/validation.ts` - Pre/post comparison with improvement classification and actionable feedback
- `src/optimization/success-criteria.ts` - Zone-based success criteria evaluation for smoothness/balance/sub
- `src/optimization/index.ts` - Updated to re-export validation and success criteria modules

## Decisions Made

1. **Proportional 50%+ threshold for success** - Prevents declaring small absolute changes on large issues as "success"
2. **Context-dependent unchanged thresholds** - 1/2/3 dB thresholds based on issue size prevent false positives
3. **Separate zone evaluations** - Three independent ZoneEvaluation objects (smoothness/balance/sub) instead of combined score for clarity
4. **should_stop only when smoothness = 'good'** - Primary metric (40-200 Hz variance) drives optimization completion
5. **Worsened threshold at -10%** - Clear trigger for "try opposite direction" guidance to users

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with clear specifications from CONTEXT.md and RESEARCH.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Validation and success criteria modules complete and ready for optimization workflow
- Zone-based progress reporting enables clear user feedback during iterative optimization
- Actionable next steps (proceed/opposite direction/try different element) guide user actions
- limitation_note mechanism alerts when +-3dB target may require acoustic treatment

---
*Phase: 07-optimization-guidance*
*Completed: 2026-01-22*
