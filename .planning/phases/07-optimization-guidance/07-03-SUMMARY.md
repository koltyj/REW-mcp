---
phase: 07-optimization-guidance
plan: 03
subsystem: optimization
tags: [mcp-tool, optimization, recommendations, validation, success-criteria, zod]

# Dependency graph
requires:
  - phase: 07-01
    provides: "Recommendation generation functions (generatePlacementRecommendation, generateSubRecommendation, generateListeningPositionRecommendation)"
  - phase: 07-02
    provides: "Validation and success criteria modules (validateAdjustment, evaluateSuccessCriteria)"
  - phase: 05-analysis-interpretation
    provides: "Prioritization engine (prioritizeIssues with fixability-first scoring)"
  - phase: 04-measurement-workflow
    provides: "Measurement store for retrieval"

provides:
  - "rew.optimize_room MCP tool with multi-action interface"
  - "get_recommendation action returning single top-priority issue"
  - "validate_adjustment action for pre/post comparison"
  - "check_progress action for zone-based success criteria"
  - "One-at-a-time recommendation workflow per scientific approach"

affects: [phase-08-docs, future-optimization-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-action MCP tool with enum-based action parameter"
    - "One recommendation at a time (suggest → measure → evaluate → next)"
    - "Element-specific recommendation routing based on issue category"

key-files:
  created:
    - "src/tools/optimize-room.ts"
  modified:
    - "src/tools/index.ts"
    - "src/index.integration.test.ts"

key-decisions:
  - "One recommendation at a time per CONTEXT.md (scientific approach: suggest, measure, evaluate, then next)"
  - "Multi-action interface with get_recommendation, validate_adjustment, check_progress actions"
  - "Element-specific routing: sub_integration → generateSubRecommendation, room_modes → generateListeningPositionRecommendation"
  - "Separate success criteria evaluations (smoothness/balance/sub) not combined score"
  - "should_stop only when smoothness reaches 'good' zone (primary metric drives completion)"

patterns-established:
  - "Multi-action MCP tool pattern: single tool with action enum for related workflows"
  - "One-at-a-time recommendation: prioritize all issues, return top 1 with next_steps"
  - "Validation with next_action: improvement_type determines suggested user action"

# Metrics
duration: 4min
completed: 2026-01-21
---

# Phase 7 Plan 3: MCP Optimization Tool Summary

**Multi-action optimization tool providing one-at-a-time recommendations, pre/post validation, and zone-based progress tracking toward +-3dB target**

## Performance

- **Duration:** 4 min (226 seconds)
- **Started:** 2026-01-21T23:02:36Z
- **Completed:** 2026-01-21T23:06:22Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created rew.optimize_room MCP tool with three-action interface (get_recommendation, validate_adjustment, check_progress)
- get_recommendation detects issues from peaks/nulls/L/R/sub and returns single top-priority recommendation
- validate_adjustment compares pre/post measurements and provides next_action guidance based on improvement classification
- check_progress evaluates zone-based success criteria with should_stop flag when smoothness reaches 'good' zone
- Tool registered with MCP server, 22 tools total, all tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create optimization tool with get_recommendation action** - `856457d` (feat)
   - Input schema with action enum
   - get_recommendation detects issues and prioritizes via fixability-first scoring
   - Returns single top-priority recommendation (one at a time)
   - Generates element-specific recommendations based on category
   - Includes action scaffolds for validate_adjustment and check_progress

2. **Task 2: Add validate_adjustment and check_progress actions** - (included in Task 1 commit)
   - validate_adjustment requires pre_measurement_id, target_frequency_hz, target_category
   - Returns ValidationResult with improvement_type and next_action
   - check_progress evaluates smoothness/balance/sub zones separately
   - Error handling for missing measurements

3. **Task 3: Register tool and update exports** - `6da76a2` (feat)
   - Registered rew.optimize_room with description covering all three actions
   - Updated integration test to expect 22 tools (was 21)
   - Build and tests pass successfully

## Files Created/Modified

- `src/tools/optimize-room.ts` - Multi-action optimization guidance tool
  - get_recommendation: Detects issues, prioritizes, returns top 1
  - validate_adjustment: Pre/post comparison with next_action guidance
  - check_progress: Zone-based success criteria evaluation
- `src/tools/index.ts` - Tool registration for rew.optimize_room
- `src/index.integration.test.ts` - Updated expected tool count to 22

## Decisions Made

1. **One recommendation at a time per CONTEXT.md**
   - Scientific approach: "suggest, measure, evaluate, then next"
   - Prioritize all issues but return only top 1 with next_steps guidance
   - Prevents overwhelming user with multiple simultaneous adjustments

2. **Element-specific recommendation routing**
   - sub_integration category → generateSubRecommendation (with phase/boundary/crossover context)
   - room_modes category → generateListeningPositionRecommendation (with 38% rule)
   - Other categories → generatePlacementRecommendation (standard guidance)

3. **Separate zone evaluations in check_progress**
   - Smoothness, L/R balance, and sub integration evaluated separately
   - Not combined into single score for clarity
   - should_stop only when smoothness (primary metric) reaches 'good' zone

4. **Validation with actionable next_action**
   - success: "Good improvement. Ready to address next issue."
   - partial: "Some improvement. Consider fine-tuning or moving to next issue."
   - unchanged: "No significant change detected. Try a different adjustment or element."
   - worsened: "This worsened the response. Try moving the opposite direction."

## Deviations from Plan

None - plan executed exactly as written.

Task 2 actions (validate_adjustment and check_progress) were fully implemented in Task 1 commit alongside get_recommendation, as they shared the same file and were straightforward integrations of existing validation and success-criteria modules.

## Issues Encountered

None - straightforward integration of existing optimization modules into multi-action MCP tool pattern.

## Next Phase Readiness

- Optimization guidance workflow complete
- Wave 2 complete (07-01, 07-02, 07-03 all done)
- Ready for Phase 8 (Documentation & Polish)
- No blockers or concerns

**Note:** Room dimensions input method (elicitation vs. manual) remains a research flag but is not blocking - tool accepts optional room_dimensions parameter and gracefully handles absence.

---
*Phase: 07-optimization-guidance*
*Completed: 2026-01-21*
