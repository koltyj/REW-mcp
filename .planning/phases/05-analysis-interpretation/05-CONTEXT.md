# Phase 5 Context: Analysis & Interpretation

**Captured:** 2026-01-21
**Phase Goal:** Plain language room analysis with prioritized recommendations

## Discussion Summary

### Existing Analysis Infrastructure

The codebase has substantial analysis capabilities already implemented:

| Module | Status | Coverage |
|--------|--------|----------|
| `room-modes.ts` | Complete | Axial/tangential/oblique modes, Schroeder frequency |
| `peaks-nulls.ts` | Complete | Peak/null detection, severity, GLM addressability |
| `sub-integration.ts` | Complete | Crossover, phase, delay, polarity optimization |
| `decay.ts` | Complete | T20/T30/Topt/EDT, ISO 3382-1:2009 compliant |
| `reflections.ts` | Complete | Early reflections, ETC, C50/C80, surface estimation |
| `averaging.ts` | Complete | 5 averaging methods + SPL alignment |
| `target-curves.ts` | Complete | Built-in curves, deviation statistics, grading |

### Gaps to Fill

1. **L/R Symmetry Analysis** (ANLZ-03) - Not implemented
2. **SBIR Explicit Detection** (ANLZ-08) - Partial (hints exist, needs explicit classification)
3. **Plain Language Interpretation Layer** (ANLZ-06) - Analysis produces data, needs human-readable summaries
4. **Problem Prioritization** (ANLZ-07) - No prioritization logic exists
5. **Sub Phase Inversion Detection** (ANLZ-05) - May need explicit detection wrapper

## Decisions Captured

### Output Format

**Decision:** Data + Summary approach
- All analysis tools return structured data for programmatic use
- Include a `summary` field with plain English interpretation
- Include actionable recommendations with every identified issue

**Rationale:** Supports both automated workflows (structured data) and direct user communication (summary). Recommendations make the tool immediately useful.

**Implementation Pattern:**
```typescript
interface AnalysisResult {
  // Structured data
  issues: Issue[];
  metrics: Metrics;

  // Plain language
  summary: string;
  recommendations: Recommendation[];
}

interface Recommendation {
  action: string;        // "Move subwoofer 6 inches from rear wall"
  expected_impact: string; // "Should reduce 63Hz null by 3-6 dB"
  priority: number;      // 1 = highest
  fixability: 'easy' | 'moderate' | 'difficult' | 'unfixable';
}
```

### Prioritization Logic

**Decision:** Fixability-first prioritization
- Primary sort: What the user can actually fix
- Order: Placement adjustments > Settings changes > Room treatment > Structural/unfixable

**Unfixable Issues:** List but deprioritize
- Show unfixable issues (deep nulls, structural room modes) at the end
- Include explanation of why they can't be fixed (physics limitations)
- Helps users understand system limitations and set expectations

**Priority Categories (in order):**
1. **Placement fixes** - Speaker/sub positioning, listening position
2. **Settings fixes** - Phase, polarity, delay, crossover adjustment
3. **Treatment fixes** - Bass traps, absorption panels (requires purchase)
4. **Unfixable** - Deep nulls, structural modes, SBIR at fixed positions

**Rationale:** Users want actionable guidance. Telling someone to "fix the 42Hz null" when it's a room mode they can't address is frustrating. Better to prioritize what they can actually change.

## Requirements Mapping

| Requirement | Approach |
|-------------|----------|
| ANLZ-01: Room mode identification | Wrap existing `room-modes.ts` with interpretation layer |
| ANLZ-02: Room dimension correlation | Use existing mode correlation, dimensions optional |
| ANLZ-03: L/R symmetry analysis | New module: compare paired measurements |
| ANLZ-04: Sub integration analysis | Wrap existing `sub-integration.ts` with interpretation |
| ANLZ-05: Sub phase inversion | Extract from sub-integration, explicit detection |
| ANLZ-06: Plain language interpretation | Add summary/recommendation generation to all tools |
| ANLZ-07: Problem prioritization | New prioritization engine with fixability scoring |
| ANLZ-08: SBIR detection | Enhance `peaks-nulls.ts` with explicit SBIR classification |

## Architecture Direction

**Pattern:** Interpretation layer wrapping existing analysis

```
[Measurement Data]
       ↓
[Existing Analysis Modules] ← Already implemented
       ↓
[Interpretation Layer] ← Phase 5 focus
       ↓
[Prioritized Recommendations]
```

The existing analysis modules produce raw data. Phase 5 adds:
1. **Interpretation functions** - Convert data to plain language
2. **Prioritization engine** - Score and rank issues by fixability
3. **Recommendation generator** - Suggest specific actions
4. **New tools** - L/R symmetry, unified room analysis

## Open Questions (Resolved)

1. ~~Output format~~ → Data + Summary with recommendations
2. ~~Prioritization criteria~~ → Fixability-first
3. ~~Unfixable handling~~ → List but deprioritize with explanations

## Constraints

- Must not break existing analysis tools (backward compatible)
- Interpretations should be educational (explain the "why")
- Recommendations must be specific and actionable
- Priority scores should be deterministic and explainable
