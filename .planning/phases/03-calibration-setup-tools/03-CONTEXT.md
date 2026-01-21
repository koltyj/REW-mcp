# Phase 3: Calibration Setup Tools - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Guided mic and monitor setup before measurement. Users can calibrate mic gain (input level) and monitor levels (SPL calibration) to ensure signal quality before capturing room response. This phase covers gain staging (SETV-01 through SETV-04) and level calibration (SETV-05, SETV-06).

</domain>

<decisions>
## Implementation Decisions

### Level feedback style
- Text zones with numeric values: "⚠️ HOT (-3.2 dBFS)" or "✓ Good range (-15 dBFS)"
- 5 zones: Clipping (>-3), Hot (-3 to -10), Optimal (-10 to -20), Low (-20 to -40), Very Low (<-40 dBFS)
- Support continuous monitoring with --watch mode that updates until stopped
- Use standard REW threshold defaults for zone boundaries

### Gain guidance approach
- Step-by-step iterative guidance: "Turn down slightly, then check again"
- Target level: -12 dBFS RMS (hotter signal, better S/N)
- Use generic hardware terms: "Adjust your mic preamp gain" (applies to any setup)
- Keep guiding indefinitely — user controls when to stop (no automatic escalation)

### SPL calibration workflow
- Default target: 85 dB SPL (broadcast reference level)
- Tolerance: ±1 dB (professional accuracy required)
- Semi-automated: Claude plays pink noise via REW, reads SPL meter, calculates adjustment needed

### Problem detection behavior
- Clipping: Block measurement workflow until resolved (no bypass)
- Low signal (<-40 dBFS): Block measurement workflow until resolved (no bypass)
- No --force flag — bad measurements waste time, always enforce
- Report issues most critical first — fix worst problem, then reveal next

### Claude's Discretion
- L/R channel calibration approach (together or separately based on context)
- Exact wording of guidance messages
- When to suggest troubleshooting if user seems stuck (though keep guiding is default)

</decisions>

<specifics>
## Specific Ideas

- Semi-automated SPL calibration uses REW's generator + SPL meter integration
- The workflow should feel like a patient assistant walking through setup, not a gatekeeper
- Level zones should be clear at a glance — color/emoji indicators help

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-calibration-setup-tools*
*Context gathered: 2026-01-21*
