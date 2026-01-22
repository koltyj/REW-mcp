# Phase 5: Analysis & Interpretation - Research

**Researched:** 2026-01-21
**Domain:** Audio analysis interpretation, room acoustics problem prioritization
**Confidence:** MEDIUM

## Summary

Phase 5 adds an interpretation layer on top of existing analysis modules to provide plain language explanations and prioritized recommendations. The codebase already has comprehensive analysis infrastructure (room modes, peaks/nulls, sub integration, decay, reflections, averaging, target curves), so this phase focuses on:

1. **L/R Symmetry Analysis** - Comparing paired stereo measurements to detect asymmetry affecting stereo imaging
2. **Enhanced SBIR Detection** - Making boundary interference detection more explicit with distance-based explanations
3. **Plain Language Interpretation** - Wrapping existing analysis data with human-readable summaries
4. **Prioritization Engine** - Scoring and ranking issues by fixability (placement > settings > treatment > unfixable)
5. **Sub Phase Inversion Detection** - Explicit wrapper for 180-degree phase issues at crossover

The existing `compare.ts` tool already implements L/R symmetry comparison using the `lr_symmetry` comparison type. The existing `glm-interpret.ts` provides a pattern for interpretation layers that wrap analysis data with context-specific explanations.

**Primary recommendation:** Build interpretation wrappers around existing analysis modules following the GLM interpret pattern, add explicit SBIR classification to peaks-nulls, and create a unified room analysis tool that combines all analyses with prioritized recommendations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type-safe implementation | Already in use, ensures correctness |
| Zod | 3.x | Input validation schemas | Already in use for all tools |
| Existing analysis modules | N/A | room-modes, peaks-nulls, sub-integration, decay, reflections | Proven implementations, ISO-compliant |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | Phase uses existing modules | All functionality exists |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom interpretation | LLM-based analysis | Too slow, non-deterministic, adds complexity |
| Unified scoring | Separate tools | Less usable but more flexible - rejected per context decisions |

**Installation:**
No new dependencies required - this phase builds on existing modules.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── analysis/           # Existing - produces data
│   ├── room-modes.ts
│   ├── peaks-nulls.ts  # Enhance with explicit SBIR
│   ├── sub-integration.ts
│   └── ...
├── interpretation/     # NEW - converts data to language
│   ├── room-modes-interpret.ts
│   ├── peaks-nulls-interpret.ts
│   ├── sub-integration-interpret.ts
│   ├── lr-symmetry.ts
│   └── prioritization.ts
└── tools/             # MCP tools - orchestrate interpretation
    ├── analyze-room.ts         # Unified analysis + interpretation
    └── glm-interpret.ts        # Pattern to follow
```

### Pattern 1: Interpretation Wrapper
**What:** Function that takes analysis data and returns plain language summary + recommendations
**When to use:** For every existing analysis module
**Example:**
```typescript
// Source: Inferred from glm-interpret.ts pattern (lines 113-186)
interface InterpretedResult<T> {
  // Original data
  data: T;

  // Plain language
  summary: string;
  recommendations: Recommendation[];

  // Context
  severity: Severity;
  confidence: ConfidenceLevel;
}

interface Recommendation {
  action: string;
  expected_impact: string;
  priority: number;
  fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
  category: string;
}

function interpretRoomModes(
  modes: TheoreticalMode[],
  peaks: DetectedPeak[],
  dimensions?: RoomDimensions
): InterpretedResult<{ modes: TheoreticalMode[]; correlations: ModeCorrelation[] }> {
  // Generate summary
  const summary = `Found ${modes.length} theoretical room modes below 200 Hz. ` +
    `${peaks.filter(p => p.mode_correlation).length} detected peaks correlate with room modes.`;

  // Generate recommendations
  const recommendations: Recommendation[] = [];
  if (dimensions) {
    recommendations.push({
      action: "Consider repositioning listening position to avoid mode nulls",
      expected_impact: "May reduce modal impact by 3-6 dB",
      priority: 1,
      fixability: 'placement',
      category: 'room_modes'
    });
  }

  return { data: { modes, correlations: [] }, summary, recommendations, severity: 'moderate', confidence: 'high' };
}
```

### Pattern 2: L/R Symmetry Analysis
**What:** Compare paired L/R measurements across frequency bands to detect asymmetry
**When to use:** When analyzing stereo speaker setups
**Example:**
```typescript
// Source: Adapted from compare.ts pattern (lines 50-121)
interface SymmetryAnalysis {
  overall_symmetry: 'excellent' | 'good' | 'fair' | 'poor';
  asymmetry_score: number; // 0-1, lower is better
  band_deviations: Array<{
    band_name: string;
    frequency_range_hz: [number, number];
    level_deviation_db: number;
    variance_deviation_db: number;
    impact_on_imaging: 'none' | 'minor' | 'moderate' | 'significant';
  }>;
  recommendations: Recommendation[];
}

function analyzeLRSymmetry(
  leftMeasurement: FrequencyResponseData,
  rightMeasurement: FrequencyResponseData
): SymmetryAnalysis {
  // Calculate per-band deviations
  const bands = [
    { name: 'Bass', range: [60, 200] as [number, number] },
    { name: 'Midrange', range: [200, 2000] as [number, number] },
    { name: 'Treble', range: [2000, 20000] as [number, number] }
  ];

  const bandDeviations = bands.map(band => {
    const leftStats = calculateBandAverage(leftMeasurement.frequencies_hz, leftMeasurement.spl_db, band.range[0], band.range[1]);
    const rightStats = calculateBandAverage(rightMeasurement.frequencies_hz, rightMeasurement.spl_db, band.range[0], band.range[1]);

    const levelDeviation = Math.abs(leftStats.avg - rightStats.avg);
    const varianceDeviation = Math.abs(leftStats.variance - rightStats.variance);

    // Imaging impact thresholds (based on research: 1-2 dB noticeable)
    let impact: 'none' | 'minor' | 'moderate' | 'significant';
    if (levelDeviation < 1 && varianceDeviation < 2) impact = 'none';
    else if (levelDeviation < 2 && varianceDeviation < 4) impact = 'minor';
    else if (levelDeviation < 3 && varianceDeviation < 6) impact = 'moderate';
    else impact = 'significant';

    return {
      band_name: band.name,
      frequency_range_hz: band.range,
      level_deviation_db: levelDeviation,
      variance_deviation_db: varianceDeviation,
      impact_on_imaging: impact
    };
  });

  return {
    overall_symmetry: 'good', // Calculate from band deviations
    asymmetry_score: 0.2,
    band_deviations: bandDeviations,
    recommendations: []
  };
}

function calculateBandAverage(
  frequencies: number[],
  spl: number[],
  minFreq: number,
  maxFreq: number
): { avg: number; variance: number } {
  const values: number[] = [];
  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] >= minFreq && frequencies[i] <= maxFreq) {
      values.push(spl[i]);
    }
  }
  if (values.length === 0) return { avg: 0, variance: 0 };
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { avg, variance: Math.max(...values) - Math.min(...values) };
}
```

### Pattern 3: SBIR Detection Enhancement
**What:** Add explicit SBIR classification to null detection with distance calculation
**When to use:** Enhancing existing peaks-nulls.ts detectNulls function
**Example:**
```typescript
// Source: SBIR physics from web research + peaks-nulls.ts (lines 143-197)
interface SBIRClassification {
  is_sbir: boolean;
  confidence: ConfidenceLevel;
  estimated_boundary_distance_ft?: number;
  boundary_type?: 'rear_wall' | 'front_wall' | 'side_wall' | 'floor' | 'ceiling' | 'unknown';
  explanation: string;
}

function classifySBIR(null_: DetectedNull): SBIRClassification {
  const SPEED_OF_SOUND_FT_S = 1125; // ft/s

  // SBIR nulls are typically:
  // - Above 60 Hz (below that is room modes)
  // - Below 300 Hz (above that is less likely boundary interference)
  // - High Q (narrow nulls from single reflection)

  if (null_.frequency_hz < 60 || null_.frequency_hz > 300) {
    return {
      is_sbir: false,
      confidence: 'high',
      explanation: 'Frequency outside typical SBIR range (60-300 Hz)'
    };
  }

  if (null_.q_factor < 5) {
    return {
      is_sbir: false,
      confidence: 'medium',
      explanation: 'Wide null suggests room mode rather than boundary interference'
    };
  }

  // Calculate boundary distance from null frequency
  // Formula: cancellation_frequency = speed_of_sound / (2 * path_length_difference)
  // Path length difference = 2 * distance_to_boundary
  // Therefore: distance = speed_of_sound / (4 * cancellation_frequency)
  const quarterWavelength = SPEED_OF_SOUND_FT_S / (4 * null_.frequency_hz);

  // SBIR typically occurs when speaker is 1-4 ft from boundary
  const is_sbir = quarterWavelength >= 1 && quarterWavelength <= 4;

  return {
    is_sbir,
    confidence: 'high',
    estimated_boundary_distance_ft: quarterWavelength,
    boundary_type: 'unknown', // Would need position data to determine
    explanation: is_sbir
      ? `Narrow null at ${null_.frequency_hz.toFixed(0)} Hz suggests speaker is ~${quarterWavelength.toFixed(1)} ft from a boundary`
      : `Calculated distance (${quarterWavelength.toFixed(1)} ft) outside typical SBIR range`
  };
}
```

### Pattern 4: Prioritization Engine
**What:** Score and rank issues by fixability
**When to use:** Generating final recommendations from all analyses
**Example:**
```typescript
// Source: Inferred from context decisions + web research on prioritization order
interface PrioritizedIssue {
  issue: string;
  severity: Severity;
  fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
  priority_score: number; // 0-100, higher = more urgent
  category: string;
  recommendation: Recommendation;
}

function prioritizeIssues(
  allIssues: Array<{
    issue: string;
    severity: Severity;
    fixability: 'placement' | 'settings' | 'treatment' | 'unfixable';
    category: string;
  }>
): PrioritizedIssue[] {
  // Fixability weights (per context decisions)
  const fixabilityWeights = {
    placement: 100,  // Highest priority - free and effective
    settings: 75,    // High priority - easy to change
    treatment: 50,   // Medium priority - costs money
    unfixable: 10    // Low priority - informational only
  };

  // Severity weights
  const severityWeights = {
    significant: 100,
    moderate: 60,
    minor: 30,
    negligible: 10
  };

  const prioritized = allIssues.map(issue => {
    // Combined score: fixability (60%) + severity (40%)
    const score =
      (fixabilityWeights[issue.fixability] * 0.6) +
      (severityWeights[issue.severity] * 0.4);

    return {
      ...issue,
      priority_score: score,
      recommendation: generateRecommendation(issue)
    };
  });

  // Sort by priority score descending
  return prioritized.sort((a, b) => b.priority_score - a.priority_score);
}

function generateRecommendation(issue: { issue: string; fixability: string; category: string }): Recommendation {
  // Generate specific action based on category and fixability
  return {
    action: `Fix ${issue.issue}`,
    expected_impact: "3-6 dB improvement",
    priority: 1,
    fixability: issue.fixability as 'placement' | 'settings' | 'treatment' | 'unfixable',
    category: issue.category
  };
}
```

### Anti-Patterns to Avoid
- **Over-interpretation:** Don't infer causation without confidence - flag as LOW confidence instead
- **Ignoring existing data:** All interpretation must use existing analysis modules, not re-implement
- **Static thresholds:** Use context-aware thresholds (e.g., GLM context changes what's "good")
- **Recommendation overload:** Prioritize top 3-5 issues, don't overwhelm with 20 recommendations

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Room mode calculation | Custom wavelength math | Existing room-modes.ts | ISO-compliant, handles axial/tangential/oblique |
| Peak/null detection | Manual local max/min | Existing peaks-nulls.ts | Handles Q-factor, GLM addressability |
| Sub integration | Phase math from scratch | Existing sub-integration.ts | Complex group delay, polarity, summation prediction |
| Frequency band averaging | Custom loops | Existing compare.ts pattern (lines 50-72) | Already handles edge cases |
| SBIR physics calculation | Manual wavelength formula | Enhance peaks-nulls.ts | Add classification, don't rebuild detection |

**Key insight:** This phase is about interpretation, not new analysis. Reuse all existing modules.

## Common Pitfalls

### Pitfall 1: L/R Symmetry Threshold Confusion
**What goes wrong:** Treating 1 dB deviation as insignificant when it's actually noticeable
**Why it happens:** Misunderstanding audibility thresholds - research shows 1-2 dB channel mismatch affects imaging
**How to avoid:** Use tiered thresholds: <1 dB = excellent, 1-2 dB = good, 2-3 dB = fair, >3 dB = poor
**Warning signs:** User reports imaging issues but analysis says "no problem"

### Pitfall 2: SBIR Distance Range Confusion
**What goes wrong:** Flagging all nulls as SBIR or missing actual SBIR issues
**Why it happens:** Not constraining to typical SBIR distance range (1-4 ft from boundary)
**How to avoid:**
- Calculate quarter-wavelength distance: `distance_ft = 1125 / (4 * frequency_hz)`
- Only flag as SBIR if distance is 1-4 ft AND frequency is 60-300 Hz AND Q > 5
- Nulls below 60 Hz are likely room modes, not SBIR
**Warning signs:** SBIR flagged at 40 Hz (room mode territory) or 500 Hz (too high)

### Pitfall 3: Priority Score Without Context
**What goes wrong:** Recommending expensive treatment before free placement adjustments
**Why it happens:** Scoring severity without considering fixability
**How to avoid:** Fixability-first scoring as defined in Pattern 4 (placement: 100, settings: 75, treatment: 50, unfixable: 10)
**Warning signs:** First recommendation is "add bass traps" when speaker is 3.5 ft from wall (classic SBIR distance)

### Pitfall 4: Sub Phase Inversion False Positives
**What goes wrong:** Recommending polarity inversion when phase is naturally 90 degrees at crossover
**Why it happens:** Confusing phase difference with polarity inversion need
**How to avoid:** Only flag inversion when phase difference is 150-210 degrees (near 180°), not 60-120 degrees
**Warning signs:** Recommendation to invert when existing sub-integration analysis shows "good" alignment

### Pitfall 5: Interpretation Without Data Confidence
**What goes wrong:** Making definitive statements from low-confidence measurements
**Why it happens:** Not propagating confidence levels from analysis to interpretation
**How to avoid:** Every interpretation must include confidence level from source data, downgrade if multiple sources disagree
**Warning signs:** "System is excellent" when measurement has 3+ data quality warnings

## Code Examples

Verified patterns from existing codebase:

### L/R Symmetry Analysis (Existing Pattern)
```typescript
// Source: compare.ts (lines 12-20, 161-210)
// L/R symmetry is already a ComparisonType
const compareInput = {
  measurement_ids: ['left_measurement_id', 'right_measurement_id'],
  comparison_type: 'lr_symmetry' as const,
  frequency_range_hz: [20, 20000] as [number, number]
};

// Produces FrequencyBandAnalysis[] with:
// - level_delta_db (difference between L and R)
// - variance_delta_db (difference in variance)
// - assessment: 'improved' | 'slightly_improved' | 'unchanged' | etc.
```

### Interpretation Wrapper Pattern (Existing)
```typescript
// Source: glm-interpret.ts (lines 113-186)
function interpretSingleMeasurement(
  measurement: {
    quick_stats: { variance_20_200hz_db: number };
    data_quality: { confidence: ConfidenceLevel };
  },
  glmVersion: 'glm3' | 'glm4' | 'unknown'
): GLMInterpretResult {
  const behaviorNotes: Array<{
    observation: string;
    explanation: string;
    is_expected: boolean;
  }> = [];

  const bassVariance = measurement.quick_stats.variance_20_200hz_db;

  if (bassVariance < 6) {
    behaviorNotes.push({
      observation: 'Low bass variance detected',
      explanation: 'GLM appears to have successfully smoothed bass response',
      is_expected: true
    });
  }

  // Return interpreted result with verdict and recommendations
  return {
    interpretation_type: 'single_measurement',
    glm_version: glmVersion,
    analysis_confidence: measurement.data_quality.confidence,
    overall_verdict: {
      glm_calibration_quality: 'excellent',
      remaining_issues_summary: [],
      system_readiness: 'ready',
      primary_recommendation: 'System is well calibrated',
      acceptance_note: 'GLM has performed cut-only correction within its capabilities'
    }
    // ... other fields
  };
}
```

### Sub Phase Inversion Detection (Existing)
```typescript
// Source: sub-integration.ts (lines 352-396)
function analyzePolarity(
  mains: FrequencyResponseData,
  sub: FrequencyResponseData,
  crossoverHz: number,
  currentPolarity: 'normal' | 'inverted' = 'normal'
): PolarityRecommendation {
  // Get magnitude and phase at crossover
  const mainsMag = dbToLinear(interpolateSPL(mains, crossoverHz));
  const subMag = dbToLinear(interpolateSPL(sub, crossoverHz));
  const mainsPhase = interpolatePhase(mains, crossoverHz) * Math.PI / 180;
  let subPhase = interpolatePhase(sub, crossoverHz) * Math.PI / 180;

  // Calculate combined magnitude with current polarity
  const currentReal = mainsMag * Math.cos(mainsPhase) + subMag * Math.cos(subPhase);
  const currentImag = mainsMag * Math.sin(mainsPhase) + subMag * Math.sin(subPhase);
  const currentMag = Math.sqrt(currentReal * currentReal + currentImag * currentImag);

  // Calculate with inverted polarity
  const invertedReal = mainsMag * Math.cos(mainsPhase) + subMag * Math.cos(subPhase + Math.PI);
  const invertedImag = mainsMag * Math.sin(mainsPhase) + subMag * Math.sin(subPhase + Math.PI);
  const invertedMag = Math.sqrt(invertedReal * invertedReal + invertedImag * invertedImag);

  const currentDb = linearToDb(currentMag);
  const invertedDb = linearToDb(invertedMag);
  const improvement = invertedDb - currentDb;

  const shouldInvert = improvement > 1; // Only recommend if improvement > 1 dB

  return {
    current_polarity: currentPolarity,
    recommended_polarity: shouldInvert
      ? (currentPolarity === 'normal' ? 'inverted' : 'normal')
      : currentPolarity,
    invert_recommended: shouldInvert,
    expected_improvement_db: Math.round(Math.max(0, improvement) * 10) / 10,
    confidence: Math.abs(improvement) > 3 ? 'high' : 'medium'
  };
}

// This already detects near-180-degree phase issues
// ANLZ-05 is satisfied by wrapping this with explicit detection
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual analysis interpretation | Automated interpretation layers | 2023-2024 | AI-assisted explanations becoming standard |
| Severity-first prioritization | Fixability-first prioritization | 2024+ | User-centric (what can I actually fix?) |
| Single-measurement analysis | Comparative analysis (before/after, L/R) | Always available | Better context for recommendations |
| Technical language only | Plain language + technical data | 2024+ | Accessibility for non-experts |

**Deprecated/outdated:**
- **LLM-based interpretation:** Too slow, non-deterministic, hallucination risk - use rule-based interpretation
- **Unified severity scale:** Different domains (decay, peaks, modes) need domain-specific thresholds

## Open Questions

Things that couldn't be fully resolved:

1. **L/R Symmetry Phase Analysis**
   - What we know: Level and variance deviations indicate asymmetry, 1-2 dB is noticeable
   - What's unclear: Should phase asymmetry be analyzed separately? How much phase deviation affects imaging?
   - Recommendation: Start with level/variance only (per existing compare.ts pattern), add phase if needed in validation

2. **SBIR Boundary Type Detection**
   - What we know: Can calculate distance from null frequency, typical range is 1-4 ft
   - What's unclear: Cannot determine which boundary (rear/front/side/floor/ceiling) without position data
   - Recommendation: Report estimated distance, flag as "unknown boundary" unless user provides position data

3. **Multi-Issue Prioritization Edge Cases**
   - What we know: Fixability-first scoring works for individual issues
   - What's unclear: How to prioritize when fixing one issue might affect another (e.g., speaker repositioning fixes SBIR but creates new mode)
   - Recommendation: Start with independent scoring, add conflict detection in future phase if needed

4. **Context-Specific Interpretation**
   - What we know: GLM context changes what's "acceptable" (cut-only correction has different expectations)
   - What's unclear: How many contexts to support? (Dirac, Audyssey, manual EQ, no correction, etc.)
   - Recommendation: Start with generic interpretation + GLM-specific (already exists), add others if requested

## Sources

### Primary (HIGH confidence)
- Existing codebase modules:
  - `/src/analysis/room-modes.ts` - ISO-compliant room mode calculation
  - `/src/analysis/peaks-nulls.ts` - Peak/null detection with Q-factor and GLM addressability
  - `/src/analysis/sub-integration.ts` - Crossover phase, polarity, delay analysis
  - `/src/tools/compare.ts` - L/R symmetry comparison pattern
  - `/src/tools/glm-interpret.ts` - Interpretation layer pattern
  - `/src/types/index.ts` - Type definitions for analysis results

### Secondary (MEDIUM confidence)
- [GIK Acoustics - SBIR](https://www.gikacoustics.com/speaker-boundary-interference-response-sbir/) - SBIR physics and detection
- [Acoustic Frontiers - SBIR](https://acousticfrontiers.com/blogs/acoustic-analysis/what-is-speaker-boundary-interference) - SBIR calculation formula: cancellation_frequency = speed_of_sound / (2 * path_length_difference)
- [PS Audio - Optimizing the Listening Room](https://www.psaudio.com/blogs/copper/from-em-the-audiophile-s-guide-em-optimizing-the-listening-room-3) - Prioritization: speaker placement before treatment
- [GIK Acoustics - Audiophile Room Treatment](https://www.gikacoustics.com/audiophile-2-channel-listening-room-acoustics/) - Speaker placement priority, then treatment
- [Black Ghost Audio - Room Acoustics](https://www.blackghostaudio.com/blog/how-to-improve-room-acoustics-without-acoustic-treatment) - Free fixes (placement) before paid fixes (treatment)

### Tertiary (LOW confidence, needs validation)
- [TestHiFi - L/R Frequency Response](https://testhifi.com/2020/06/19/frequency-response-left-versus-right-sum-and-stereo/) - L/R matching importance for stereo imaging
- [Audio Master Class - Stereo Frequency Response](https://www.audiomasterclass.com/blog/the-frequency-response-problem-that-affects-all-stereo-recordings) - Channel matching requirements
- [Audioreputation - Subwoofer Phase](https://audioreputation.com/subwoofer-phase-0-or-180/) - 180-degree phase detection methodology
- Web searches (2026) - General thresholds: 1 dB = smallest detectable change, 3 dB = quite noticeable, 10 dB = twice as loud

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists, no new libraries needed
- Architecture: HIGH - Clear patterns in existing code (glm-interpret.ts, compare.ts)
- L/R Symmetry: MEDIUM - Pattern exists in compare.ts, audibility thresholds from web research (needs validation)
- SBIR Detection: MEDIUM - Physics formulas verified, implementation pattern clear, distance classification needs testing
- Prioritization: MEDIUM - Fixability-first approach from web research + context decisions, scoring formula is inferred
- Pitfalls: HIGH - Based on existing code patterns and common acoustic analysis mistakes

**Research date:** 2026-01-21
**Valid until:** 60 days (stable domain - room acoustics fundamentals don't change rapidly, but implementation patterns evolve)
