# Phase 7: Optimization Guidance - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Data-driven placement recommendations with validation. Users receive actionable suggestions for monitor placement, sub position optimization, and listening position adjustments. Pre/post comparison quantifies improvement and validates that adjustments actually helped. Success criteria evaluation shows progress toward target (±3dB 40-200Hz).

</domain>

<decisions>
## Implementation Decisions

### Recommendation Specificity
- Directional guidance only — "move monitors away from wall" not "move exactly 3.2 inches"
- Brief physics context — "This addresses the 125Hz dip caused by wall reflection"
- Confidence through natural language hedging — "likely caused by..." vs "could be..."
- Sub gets more detail than monitors — include phase, corner loading, boundary effects

### Validation Flow
- Both session-based and explicit pairing supported — session tracking by default, explicit IDs as fallback
- Always prompt for re-measurement after user makes adjustment
- Report improvement with both numbers and plain language — "Variance improved from 8.2dB to 4.1dB (50% reduction)"
- If adjustment worsens response: analyze why and suggest next action — "This worsened the 80Hz null. Try moving the opposite direction."

### Success Criteria
- Zone-based progress display — "Good (within target)" / "Acceptable (±4-5dB)" / "Needs work (>±5dB)"
- Suggest stopping when target achieved — "You've reached ±3dB — further gains will be marginal"
- If target physically impossible: keep target, explain limitation — "Target ±3dB may not be achievable without treatment at 63Hz"
- Separate evaluations for smoothness, L/R balance, and sub integration — not a single combined metric

### Recommendation Prioritization
- Biggest issue first — fix the worst problem regardless of which element it affects
- One recommendation at a time — suggest, measure, evaluate, then next (scientific approach)
- Optimize for worst remaining issue when tradeoffs occur — always prioritize the biggest problem
- Session-only tracking of tried recommendations — reset on new session

### Claude's Discretion
- Exact zone thresholds for "Acceptable" vs "Needs work"
- How to calculate "biggest issue" (peak deviation vs variance vs combination)
- Specific wording of physics explanations
- When to suggest trying opposite direction vs different element

</decisions>

<specifics>
## Specific Ideas

- Recommendations should feel like advice from an experienced engineer, not a robotic checklist
- Sub placement deserves extra attention because it's both more impactful and more complex
- The one-at-a-time approach prevents "I changed three things and don't know what helped"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-optimization-guidance*
*Context gathered: 2026-01-22*
