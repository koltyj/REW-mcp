---
phase: 03-calibration-setup-tools
plan: 03
subsystem: api
tags: [spl-calibration, pink-noise, monitor-calibration, mcp-tools, rew-api]

# Dependency graph
requires:
  - phase: 03-01
    provides: api-generator and api-spl-meter low-level tools
provides:
  - Semi-automated SPL calibration workflow tool (rew.api_calibrate_spl)
  - Start/check/stop pattern for interactive monitor level calibration
affects: [03-04-user-workflows, later calibration workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-step-workflow-tool, stabilization-delays, user-guidance-generation]

key-files:
  created:
    - src/tools/api-calibrate-spl.ts
  modified:
    - src/tools/index.ts

key-decisions:
  - "Use start/check/stop pattern for semi-automated workflows requiring user interaction"
  - "Include stabilization delays (2s for generator, 1s for SPL meter) for accurate readings"
  - "Generate user-friendly guidance messages with specific dB adjustment recommendations"
  - "Default to C-weighting and 85 dB target (broadcast reference standard)"

patterns-established:
  - "Multi-step workflow tools: start (initialize), check (verify + get guidance), stop (cleanup)"
  - "Workflow tools calculate adjustments and provide actionable guidance, not just raw data"
  - "Use setTimeout for stabilization delays in async workflows"

# Metrics
duration: 2min
completed: 2026-01-21
---

# Phase 03 Plan 03: SPL Calibration Tool Summary

**Semi-automated SPL calibration workflow with pink noise generation, SPL meter reading, and real-time adjustment guidance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-21T23:31:10Z
- **Completed:** 2026-01-21T23:33:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created rew.api_calibrate_spl workflow tool with start/check/stop actions
- Automated pink noise playback at -20 dBFS with 2-second stabilization
- SPL meter integration with configurable weighting (A/C/Z) and 1-second averaging delay
- Real-time adjustment calculation and user guidance ("increase by X dB" / "target achieved")

## Task Commits

Each task was committed atomically:

1. **Task 1: Create api-calibrate-spl.ts tool** - `6139e98` (feat)
2. **Task 2: Register api-calibrate-spl tool in index.ts** - `85c2aa6` (feat)

## Files Created/Modified
- `src/tools/api-calibrate-spl.ts` - SPL calibration workflow tool with start/check/stop actions
- `src/tools/index.ts` - Registered rew.api_calibrate_spl tool

## Decisions Made

**1. Start/check/stop workflow pattern**
- Rationale: Semi-automated calibration requires user to manually adjust volume between checks. Breaking into discrete steps allows iterative refinement without maintaining long-running sessions.

**2. Stabilization delays (2s generator, 1s SPL meter)**
- Rationale: Generator needs time to reach steady-state pink noise output. SPL meter needs time for Slow filter averaging. These delays ensure accurate readings.

**3. User guidance generation**
- Rationale: Rather than just returning "current: 82 dB, target: 85 dB", tool calculates adjustment (+3 dB) and provides actionable guidance ("Increase monitor volume by approximately 3.0 dB"). Makes tool usable without user doing mental math.

**4. Default to 85 dB C-weighted**
- Rationale: 85 dB is broadcast reference level (SMPTE RP 200). C-weighting is appropriate for full-range monitoring (flat low-frequency response, unlike A-weighting which rolls off bass).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- SPL calibration workflow ready for integration into higher-level user workflows
- Tool follows same action-based pattern as other API tools (generator, SPL meter, audio)
- Ready for 03-04 user workflow composition

---
*Phase: 03-calibration-setup-tools*
*Completed: 2026-01-21*
