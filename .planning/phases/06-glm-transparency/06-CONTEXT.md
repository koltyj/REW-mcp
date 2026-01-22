# Phase 6: GLM Transparency Layer - Context

**Phase Goal:** Users understand what GLM calibration did and couldn't fix
**Discussion Date:** 2026-01-21
**Status:** Ready for planning

## Decisions Made

### Baseline Detection

**Question:** How should pre-GLM vs post-GLM measurements be identified?
**Decision:** Hybrid Approach
- Accept explicit measurement IDs when provided by user
- Fall back to naming pattern detection if IDs not provided
- Naming patterns: 'pre', 'post', 'before', 'after', 'GLM' in measurement names

**Rationale:** Flexibility for both explicit workflows and automatic detection from REW measurement names.

### Required Input

**Question:** Should comparison require both pre and post measurements?
**Decision:** Both with Fallback
- Prefer both pre and post measurements for full comparison
- Provide limited analysis if only post-GLM is available (heuristic mode)
- Heuristics: deep nulls = GLM couldn't fix, flat regions likely = GLM success

**Rationale:** Full comparison is ideal, but users may only have post-GLM data available.

### Correction Thresholds

**Question:** What dB improvement qualifies as 'GLM successfully corrected'?
**Decision:** Proportional
- 50%+ reduction of original deviation counts as success
- Example: 8 dB peak → <4 dB remaining = success
- Example: 12 dB peak → <6 dB remaining = success

**Question:** What defines 'unchanged' vs 'partially addressed'?
**Decision:** Context-dependent thresholds
- Small issues (<6 dB): <1 dB change = unchanged
- Medium issues (6-10 dB): <2 dB change = unchanged
- Large issues (>10 dB): <3 dB change = unchanged

**Rationale:** Absolute thresholds don't account for issue magnitude. Proportional approach reflects user-perceivable improvement. Context-dependent "unchanged" accounts for measurement variance on larger deviations.

### Overcorrection Detection

**Question:** How should GLM overcorrection artifacts be detected?
**Decision:** Combined Indicators
- Check bass region flatness: unnaturally flat (<2 dB variance) below 40 Hz
- Check null revelation: nulls appearing more prominent post-GLM (contrast increase)
- Both indicators contribute to overcorrection assessment

**Question:** How severe must overcorrection be to warrant a warning?
**Decision:** Informational
- Always note potential overcorrection as observation
- Do not escalate to warning level (let users decide significance)
- Include explanation of what "too-flat" bass might sound like

**Rationale:** Overcorrection is subjective and depends on user preference. Inform rather than warn.

### Integration Pattern

**Question:** How should GLM transparency integrate with existing tools?
**Decision:** Merge into analyze-room
- Add optional `pre_measurement_id` parameter to `rew.analyze_room`
- When pre-measurement provided, include GLM comparison section in output
- Existing single-measurement analysis continues to work unchanged

**Question:** Should GLM interpretation reuse Phase 5 interpretation modules?
**Decision:** Selective Reuse
- Reuse types: Recommendation, InterpretedResult, Severity, Fixability
- Reuse SBIR classification from peaks-nulls-interpret.ts
- Reuse prioritization engine from prioritization.ts
- Implement GLM-specific comparison logic in new module

**Rationale:** Unified tool reduces user cognitive load. Selective reuse maintains separation of concerns while avoiding duplication.

## Technical Constraints

### From glm-context.md
- GLM applies cuts only, never boosts (except rare HF)
- Focus on low/low-mid frequencies (<1 kHz)
- Minimum phase filters only (cannot fix time-domain issues)
- Deep nulls (>10-15 dB) are left untouched

### From Existing Code
- `src/tools/glm-interpret.ts` exists as stub (simplified implementation)
- `GLMCorrection` and `GLMBeyondScope` types already defined
- `measurementStore` provides measurement retrieval

### Phase Dependencies
- Phase 5 interpretation modules available for reuse
- SBIR classification (60-300 Hz, Q>5, 1-4 ft distance)
- Fixability-first prioritization (60% fixability + 40% severity)

## Implementation Implications

1. **analyze-room.ts modifications:**
   - Add optional `pre_measurement_id` to input schema
   - Add GLM comparison section to output when pre-measurement provided
   - Graceful degradation to post-only heuristics if pre not available

2. **New interpretation module:**
   - `src/interpretation/glm-comparison.ts` for comparison logic
   - Imports SBIR classification, prioritization engine
   - Implements proportional correction thresholds
   - Implements context-dependent unchanged thresholds

3. **Output structure additions:**
   - `glm_successes[]` - peaks/issues successfully corrected
   - `glm_persistent[]` - issues beyond GLM scope with explanations
   - `glm_observations[]` - informational notes about GLM behavior
   - `overcorrection_indicators{}` - flatness/contrast observations

## Gray Areas Resolved

| Area | Resolution |
|------|------------|
| Baseline Detection | Hybrid: explicit IDs with naming fallback |
| Input Requirements | Both preferred, post-only fallback mode |
| Success Threshold | Proportional (50%+ reduction) |
| Unchanged Threshold | Context-dependent (<1/2/3 dB by issue size) |
| Overcorrection | Combined indicators (flatness + contrast) |
| Warning Level | Informational only |
| Integration | Merge into analyze-room |
| Code Reuse | Selective (types + SBIR + prioritization) |

---
*Created: 2026-01-21*
*Workflow: /gsd:discuss-phase 6*
