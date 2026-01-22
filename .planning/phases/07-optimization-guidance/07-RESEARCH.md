# Phase 7: Optimization Guidance - Research

**Researched:** 2026-01-21
**Domain:** Room acoustics optimization, recommendation systems, pre/post validation
**Confidence:** HIGH

## Summary

Optimization guidance in room acoustics follows established principles from speaker placement physics, boundary interaction theory, and statistical validation methods. The standard approach prioritizes one recommendation at a time (scientific method), validates improvements through statistical metrics (variance reduction, peak/null deviation), and provides directional guidance based on acoustic physics rather than exact measurements.

Key findings:
- **Iterative optimization**: One-at-a-time changes prevent "I changed three things and don't know what helped" (A/B testing principle)
- **Statistical validation**: 50%+ reduction = success (proportional threshold), variance as primary smoothness metric, context-dependent thresholds (<1/2/3 dB based on issue size)
- **Physics-based recommendations**: SBIR uses quarter-wavelength formula (distance_ft = 1125 / (4 * frequency_hz)), corner loading provides +3dB per boundary, room modes avoided via 38% rule
- **Success criteria zones**: Industry standard ±3dB target (40-200 Hz with 1/3 octave smoothing), separate evaluations for smoothness/balance/integration

**Primary recommendation:** Use variance reduction as primary success metric, prioritize biggest remaining issue regardless of element affected, provide directional guidance with brief physics context, validate each change before suggesting next.

## Standard Stack

### Core Metrics
| Metric | Formula/Approach | Purpose | Why Standard |
|--------|------------------|---------|--------------|
| Variance (range) | max(SPL) - min(SPL) in band | Smoothness evaluation | Simple, interpretable, matches human perception of "bumpy" response |
| Peak deviation | peak_level - local_average | Peak severity | Already implemented in peaks-nulls.ts (local average with 0.3 octave window) |
| Improvement % | (pre - post) / pre * 100 | Proportional validation | Proportional threshold (50%+) prevents declaring success on small changes |
| L/R symmetry | abs(left_SPL - right_SPL) | Balance evaluation | Industry standard <1 dB excellent, 1-2 dB good, 2-3 dB fair, >3 dB poor |

### Supporting Calculations
| Calculation | Formula | Purpose | When to Use |
|-------------|---------|---------|-------------|
| SBIR distance | 1125 / (4 * freq_hz) | Boundary distance estimate | Q>5 nulls in 60-300 Hz range (already in peaks-nulls-interpret.ts) |
| Corner loading gain | +3 dB per boundary | Sub placement impact | Explaining why corner placement boosts bass |
| Room mode null positions | L/2, L/4, 3L/4 (length L) | Null avoidance zones | When room dimensions provided |
| 38% rule | 0.38 * room_length | Optimal listening position | General guidance when specific mode analysis unavailable |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Variance (range) | Standard deviation | Std dev more mathematically rigorous but harder to explain to users |
| 50% improvement threshold | Fixed dB threshold (e.g., 3 dB) | Fixed threshold fails for small issues (1 dB improvement on 2 dB issue is 50% success) |
| One-at-a-time | Multiple simultaneous changes | Faster but prevents attribution of which change helped |

**Installation:**
No external libraries required - calculations use existing analysis functions.

## Architecture Patterns

### Recommended Structure
```
src/
├── optimization/
│   ├── recommendations.ts      # Generate placement/position recommendations
│   ├── validation.ts            # Pre/post comparison and success evaluation
│   └── prioritization.ts        # Determine biggest remaining issue
├── tools/
│   └── optimize-room.ts         # MCP tool: optimization guidance workflow
```

### Pattern 1: Recommendation Generation
**What:** Generate actionable placement recommendations based on detected issues
**When to use:** After issue detection (Phase 5) or pre/post comparison (Phase 6)
**Example:**
```typescript
// Directional guidance with physics context
interface PlacementRecommendation {
  element: 'monitors' | 'subwoofer' | 'listening_position';
  action: string; // "Move monitors away from wall"
  reason: string; // "This addresses the 125Hz dip caused by SBIR"
  confidence: 'high' | 'medium' | 'low';
  expected_improvement: string; // "May reduce null by 3-6 dB"
  issue_addressed: DetectedIssue; // Link back to specific issue
}

function generateRecommendation(issue: DetectedIssue): PlacementRecommendation {
  if (issue.type === 'sbir_null') {
    const distance = 1125 / (4 * issue.frequency_hz);
    return {
      element: 'monitors',
      action: `Move monitors away from boundary (currently ~${distance.toFixed(1)} ft)`,
      reason: `SBIR null at ${issue.frequency_hz} Hz caused by quarter-wavelength cancellation`,
      confidence: 'high',
      expected_improvement: 'Can reduce null by 3-10 dB',
      issue_addressed: issue
    };
  }
  // ... other issue types
}
```

### Pattern 2: Pre/Post Validation
**What:** Compare measurements before/after adjustment to validate improvement
**When to use:** After user makes recommended change and re-measures
**Example:**
```typescript
// Already implemented in glm-comparison.ts, reuse pattern
interface ValidationResult {
  improvement_type: 'success' | 'partial' | 'unchanged' | 'worsened';
  metric: string; // "Variance improved from 8.2dB to 4.1dB"
  improvement_percent: number;
  next_action: string; // "Try moving the opposite direction" if worsened
  explanation: string; // Plain language context
}

function validateAdjustment(
  pre: StoredMeasurement,
  post: StoredMeasurement,
  target_issue: DetectedIssue
): ValidationResult {
  // Calculate relevant metric for issue type
  const preMetric = calculateMetric(pre, target_issue);
  const postMetric = calculateMetric(post, target_issue);
  const improvement = ((preMetric - postMetric) / preMetric) * 100;

  // Classify improvement (reuse glm-comparison logic)
  if (improvement >= 50) return { improvement_type: 'success', ... };
  if (improvement < 0) return {
    improvement_type: 'worsened',
    next_action: 'Try moving the opposite direction',
    ...
  };
  // ...
}
```

### Pattern 3: Biggest Issue Prioritization
**What:** Identify worst remaining issue to address next
**When to use:** After successful improvement or when starting optimization
**Example:**
```typescript
// Reuse fixability-first scoring from Phase 5
interface PrioritizedIssue {
  issue: DetectedIssue;
  priority_score: number; // Combines severity + fixability
  is_biggest: boolean;
  recommendation: PlacementRecommendation;
}

function prioritizeNextIssue(
  issues: DetectedIssue[],
  tried_recommendations: Set<string> // Session-only tracking
): PrioritizedIssue | null {
  // Filter out already-tried recommendations
  const untried = issues.filter(i =>
    !tried_recommendations.has(recommendationKey(i))
  );

  // Score using existing fixability-first logic
  // 60% fixability + 40% severity (from 05-01 decision)
  const scored = untried.map(issue => ({
    issue,
    priority_score: calculatePriorityScore(issue),
    is_biggest: false,
    recommendation: generateRecommendation(issue)
  }));

  // Return highest priority
  scored.sort((a, b) => b.priority_score - a.priority_score);
  if (scored.length > 0) {
    scored[0].is_biggest = true;
    return scored[0];
  }
  return null;
}
```

### Pattern 4: Success Criteria Evaluation
**What:** Zone-based progress display for ±3dB target
**When to use:** After each measurement to show progress toward goal
**Example:**
```typescript
interface SuccessCriteriaResult {
  zone: 'good' | 'acceptable' | 'needs_work';
  variance_db: number;
  target_db: number;
  progress_message: string;
  should_stop: boolean; // Suggest stopping when target achieved
}

function evaluateSuccessCriteria(
  measurement: StoredMeasurement,
  target_range: { min_hz: number; max_hz: number } = { min_hz: 40, max_hz: 200 }
): SuccessCriteriaResult {
  const variance = calculateVariance(measurement, target_range);
  const target_db = 3; // ±3dB industry standard

  let zone: 'good' | 'acceptable' | 'needs_work';
  let progress_message: string;

  if (variance <= target_db) {
    zone = 'good';
    progress_message = `Within target (±${variance.toFixed(1)} dB) — further gains will be marginal`;
    should_stop = true;
  } else if (variance <= 5) {
    zone = 'acceptable';
    progress_message = `Close to target (±${variance.toFixed(1)} dB vs ±${target_db} dB goal)`;
    should_stop = false;
  } else {
    zone = 'needs_work';
    progress_message = `${variance.toFixed(1)} dB variance — target is ±${target_db} dB`;
    should_stop = false;
  }

  return { zone, variance_db: variance, target_db, progress_message, should_stop };
}
```

### Anti-Patterns to Avoid
- **Multiple simultaneous recommendations:** Breaks one-at-a-time principle, prevents attribution
- **Exact distance specifications:** "Move 3.2 inches" instead of "Move away from wall" (false precision)
- **Combined metrics:** Single "room score" instead of separate smoothness/balance/integration evaluations
- **Percentage-only reporting:** "50% improvement" without dB context lacks interpretability

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Statistical significance testing | Custom p-value calculations | Proportional threshold (50%+) + context-dependent unchanged thresholds | Room acoustics doesn't need formal hypothesis testing - perceptual thresholds (1/2/3 dB) are well-established |
| Complex recommendation AI | Neural network for recommendation generation | Rule-based physics heuristics (SBIR formula, corner loading, mode nulls) | Acoustic physics is deterministic and well-understood - ML adds complexity without benefit |
| Smoothing algorithms | Custom frequency response smoothing | Use REW's existing smoothing API or accept pre-smoothed data | REW already implements proper octave smoothing (Gaussian kernels, ERB) |
| Room mode calculators | Full modal analysis implementation | Simple L/2, L/4 calculations + 38% rule | Full modal analysis requires eigenvalue solutions - simple rules provide 80% of value |

**Key insight:** Room acoustics optimization is well-understood physics, not a machine learning problem. Rule-based heuristics based on established formulas (SBIR quarter-wavelength, boundary gain, modal nulls) are both simpler and more explainable than data-driven approaches.

## Common Pitfalls

### Pitfall 1: Declaring Success on Noise-Level Improvements
**What goes wrong:** Calling 0.5 dB improvement "success" when measurement repeatability is ±0.5 dB
**Why it happens:** Forgetting that measurements have inherent variance
**How to avoid:** Use context-dependent unchanged thresholds (<1 dB for small issues, <2 dB for medium, <3 dB for large) - already implemented in glm-comparison.ts getUnchangedThreshold()
**Warning signs:** Pre/post variance difference smaller than typical measurement noise

### Pitfall 2: Exact Distance Recommendations
**What goes wrong:** Recommending "move 3.2 inches" based on SBIR formula
**Why it happens:** Misunderstanding that formulas provide estimates, not exact solutions
**How to avoid:** Always give directional guidance ("move away from wall") with approximate distance context ("currently ~2.5 ft based on 113 Hz null")
**Warning signs:** User reports following exact distance but issue persists (room geometry more complex than simple boundary)

### Pitfall 3: Optimizing for Single Metric
**What goes wrong:** Achieving ±2 dB variance by creating severe L/R imbalance
**Why it happens:** Forgetting that room response is multi-dimensional (smoothness AND balance AND integration)
**How to avoid:** Separate evaluations for each dimension, flag tradeoffs when improvement in one dimension worsens another
**Warning signs:** One metric improves significantly while another degrades

### Pitfall 4: Ignoring Physical Impossibility
**What goes wrong:** Continuing to recommend changes when ±3 dB is physically impossible (e.g., severe 40 Hz mode in small room)
**Why it happens:** Not recognizing when room geometry fundamentally limits achievable response
**How to avoid:** Keep target, but explain limitation when variance hasn't improved after 2-3 attempts on same issue ("Target ±3dB may not be achievable without treatment at 63Hz")
**Warning signs:** Multiple attempts at same issue with minimal variance change (<1 dB total)

### Pitfall 5: Session Persistence Across Restarts
**What goes wrong:** Tracking "tried recommendations" across sessions, preventing users from re-trying after room changes
**Why it happens:** Over-engineering state management
**How to avoid:** Session-only tracking (Map-based like session-state.ts), automatically resets on new session
**Warning signs:** User can't get recommendation they tried yesterday because system "remembers"

## Code Examples

Verified patterns from existing codebase:

### Variance Calculation (Already Implemented)
```typescript
// Source: src/analysis/peaks-nulls.ts (calculateQuickStats)
const calculateBandStats = (minFreq: number, maxFreq: number) => {
  const values: number[] = [];
  for (let i = 0; i < frequencies_hz.length; i++) {
    if (frequencies_hz[i] >= minFreq && frequencies_hz[i] <= maxFreq) {
      values.push(spl_db[i]);
    }
  }

  if (values.length === 0) return { avg: 0, range_db: 0 };

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range_db = maxVal - minVal; // Variance metric

  return { avg, range_db };
};
```

### Improvement Classification (Already Implemented)
```typescript
// Source: src/interpretation/glm-comparison.ts (classifyCorrection)
function classifyCorrection(comparison: IssueComparison): 'success' | 'partial' | 'unchanged' {
  const { pre_deviation_db, improvement_db, improvement_percent } = comparison;

  // Check proportional threshold first
  if (improvement_percent >= 50) {
    return 'success';
  }

  // Check context-dependent unchanged threshold
  const unchangedThreshold = getUnchangedThreshold(pre_deviation_db);

  if (improvement_db < unchangedThreshold) {
    return 'unchanged';
  }

  // Between unchanged and success
  return 'partial';
}

function getUnchangedThreshold(deviation_db: number): number {
  const absDeviation = Math.abs(deviation_db);

  if (absDeviation < 6) return 1;  // Small issues: <1 dB = unchanged
  if (absDeviation < 10) return 2; // Medium issues: <2 dB = unchanged
  return 3;                        // Large issues: <3 dB = unchanged
}
```

### SBIR Detection (Already Implemented)
```typescript
// Source: src/interpretation/peaks-nulls-interpret.ts (classifySBIR)
export function classifySBIR(null_: DetectedNull): SBIRClassification {
  const { frequency_hz, q_factor } = null_;

  // SBIR typically occurs in 60-300 Hz range with high Q
  const isLikelySBIR =
    frequency_hz >= 60 &&
    frequency_hz <= 300 &&
    q_factor > 5;

  if (!isLikelySBIR) {
    return { is_sbir: false };
  }

  // Quarter-wavelength formula: distance_ft = speed_of_sound / (4 * frequency)
  const speed_of_sound_ft_per_s = 1125;
  const estimated_distance_ft = speed_of_sound_ft_per_s / (4 * frequency_hz);

  // Constrain to plausible range (1-4 ft from wall)
  if (estimated_distance_ft < 1 || estimated_distance_ft > 4) {
    return { is_sbir: false };
  }

  return {
    is_sbir: true,
    estimated_boundary_distance_ft: estimated_distance_ft,
    confidence: q_factor > 10 ? 'high' : 'medium'
  };
}
```

### Priority Scoring (Already Implemented)
```typescript
// Source: src/interpretation/prioritization.ts
export function calculatePriorityScore(
  deviation: number,
  severity: Severity,
  fixability: Fixability
): number {
  const severityWeight = 0.4;
  const fixabilityWeight = 0.6; // Prioritize free/effective fixes

  // Severity score: 0-100 based on absolute deviation
  const absDeviation = Math.abs(deviation);
  const severityScore = Math.min(absDeviation * 10, 100);

  // Fixability score: 0-100 based on category
  const fixabilityScores: Record<Fixability, number> = {
    placement: 100,   // Free, reversible, effective
    settings: 75,     // Free, reversible, moderately effective
    treatment: 50,    // Costs money, less reversible
    unfixable: 10     // Acknowledge but deprioritize
  };
  const fixabilityScore = fixabilityScores[fixability];

  // Combined score
  return severityScore * severityWeight + fixabilityScore * fixabilityWeight;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed dB thresholds | Proportional + context-dependent thresholds | Last 5 years | Prevents declaring success on noise-level changes (2019-2024 research) |
| "Room score" metrics | Separate smoothness/balance/integration evaluations | Ongoing | Avoids hiding tradeoffs in single number |
| Exact placement specs | Directional guidance with physics context | Professional practice | Reduces false precision, acknowledges room complexity |
| Manual A/B testing | One-at-a-time with systematic validation | Audio engineering standard | Scientific method prevents confusion about cause |

**Deprecated/outdated:**
- Single combined "room quality" score: Hides tradeoffs between smoothness, balance, and integration
- Exact distance recommendations based solely on formulas: Rooms are more complex than simple boundary reflections
- Fixed threshold validation (e.g., "3 dB improvement required"): Fails for small issues where 1 dB is significant

## Open Questions

Things that couldn't be fully resolved:

1. **Zone threshold boundaries**
   - What we know: ±3 dB is industry standard "good", >5 dB clearly "needs work"
   - What's unclear: Exact threshold for "acceptable" zone (±4 dB? ±5 dB?)
   - Recommendation: Use ±3 dB good, ±4-5 dB acceptable, >±5 dB needs work (based on professional studio practices)

2. **Biggest issue calculation**
   - What we know: Should prioritize worst problem, use fixability-first scoring
   - What's unclear: Peak deviation vs variance vs combination when comparing across issue types
   - Recommendation: Reuse existing priority_score from Phase 5 (60% fixability + 40% severity) - already handles cross-issue-type comparison

3. **When to suggest opposite direction**
   - What we know: If adjustment worsens response, try opposite direction
   - What's unclear: Threshold for "worsened" (any negative improvement? >-10%?)
   - Recommendation: improvement_percent < -10 = "worsened, try opposite" (filters out noise-level changes)

4. **Room dimensions input method**
   - What we know: Needed for room mode null position calculations
   - What's unclear: Elicit from user vs manual input vs optional
   - Recommendation: **Research flag** - needs design decision during planning. Leaning toward optional manual input with "room mode analysis unavailable without dimensions" message.

## Sources

### Primary (HIGH confidence)
- Existing codebase implementations:
  - `/src/analysis/peaks-nulls.ts` - Variance calculation, severity classification
  - `/src/interpretation/glm-comparison.ts` - Improvement classification, context-dependent thresholds
  - `/src/interpretation/peaks-nulls-interpret.ts` - SBIR detection with quarter-wavelength formula
  - `/src/interpretation/prioritization.ts` - Fixability-first scoring
- [RealTraps Room Setup Guide](https://realtraps.com/art_room-setup.htm) - 38% rule, speaker placement priorities
- [Acoustic Frontiers: SBIR](https://acousticfrontiers.com/blogs/acoustic-analysis/what-is-speaker-boundary-interference) - Quarter-wavelength formula verification
- [GIK Acoustics: SBIR](https://www.gikacoustics.com/speaker-boundary-interference-response-sbir/) - Mitigation strategies (placement over EQ)

### Secondary (MEDIUM confidence)
- [Spotify Reinforcement Learning for Recommendations](https://arxiv.org/html/2302.03561) - 81% improvement with A/B testing, one-change-at-a-time validation
- [ProSoundWeb: Phase Alignment](https://www.prosoundweb.com/time-phase-alignment/) - Sub crossover validation techniques
- [Ekustik: Home Studio Listening Position](https://www.ekustik.eu/home-studio-listening-position) - 38% rule, stereo triangle fundamentals
- [Genelec Monitor Placement](https://www.genelec.com/monitor-placement) - Professional symmetry standards
- Studio calibration standards (multiple sources): 78-85 dB SPL per channel, <1 dB L/R balance for excellent imaging

### Tertiary (LOW confidence)
- WebSearch results on variance/standard deviation in room acoustics - suggest std dev <1.5 dB for diffuse field, but not directly applicable to direct-field studio monitoring
- WebSearch results on statistical significance in acoustic measurements - formal hypothesis testing not necessary for perceptual thresholds

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Metrics already implemented in codebase, formulas verified against multiple authoritative sources
- Architecture: HIGH - Patterns directly reuse proven approaches from Phase 5 (prioritization) and Phase 6 (validation)
- Pitfalls: MEDIUM - Based on professional practice and common mistakes, but specific thresholds (e.g., "2-3 attempts" for impossibility) are heuristic

**Research date:** 2026-01-21
**Valid until:** 60 days (stable domain - room acoustics physics unchanged, professional standards evolve slowly)
