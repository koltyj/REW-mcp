# Guardrails

This document defines the safety constraints and quality rules the MCP server must follow to ensure honest, useful analysis without overstepping its role.

## Core Principle

**The MCP server analyzes and advises. It never decides or applies changes.**

All physical changes (speaker placement, acoustic treatment, EQ settings) are executed by humans.

---

## Prohibited Actions

### 1. Never Recommend Specific EQ Settings

❌ **Prohibited**:
```json
{
  "recommendation": "Apply a -6 dB cut at 80 Hz with Q=4"
}
```

✅ **Allowed**:
```json
{
  "observation": "Peak of +6 dB at 80 Hz with Q≈4",
  "analysis": "This peak is likely caused by room mode reinforcement",
  "suggestion": "Consider addressing via placement adjustment or allow GLM to handle"
}
```

**Rationale**: EQ recommendations require knowledge of the full signal chain, user preferences, and system capabilities. The MCP server lacks this context.

### 2. Never Recommend Filter Parameters

❌ **Prohibited**:
```json
{
  "filter": {
    "type": "parametric",
    "frequency": 80,
    "gain": -6,
    "q": 4
  }
}
```

✅ **Allowed**:
```json
{
  "issue": {
    "frequency_hz": 80,
    "type": "peak",
    "severity": "moderate",
    "q_estimate": 4
  },
  "note": "If applying manual correction, this narrow peak would require a high-Q filter"
}
```

### 3. Never Claim Certainty About Causes

❌ **Prohibited**:
```json
{
  "cause": "This null is caused by your rear wall reflection"
}
```

✅ **Allowed**:
```json
{
  "cause": "likely_boundary_interference",
  "confidence": "medium",
  "reasoning": "Frequency and depth are consistent with quarter-wave cancellation from a boundary approximately 1.4m away",
  "alternatives": ["floor_bounce", "speaker_port_cancellation"]
}
```

### 4. Never Provide Definitive "Better/Worse" Without Evidence

❌ **Prohibited**:
```json
{
  "verdict": "Placement B is better"
}
```

✅ **Allowed**:
```json
{
  "comparison": {
    "placement_a_variance_db": 8.2,
    "placement_b_variance_db": 5.1,
    "delta": -3.1
  },
  "assessment": "Placement B shows lower frequency response variance in the 40-200 Hz range",
  "verdict": "Placement B is likely preferable for bass accuracy",
  "confidence": "high",
  "caveats": ["Assumes equal SPL normalization", "Does not account for imaging/stereo concerns"]
}
```

---

## Required Disclosures

### 1. Always Disclose Confidence Level

Every analysis result must include a confidence indicator:

```json
{
  "analysis_confidence": "high | medium | low | uncertain",
  "confidence_factors": [
    "Sufficient data points",
    "Clear pattern in measurements"
  ],
  "confidence_limitations": [
    "Only single measurement position analyzed"
  ]
}
```

### 2. Always Disclose Data Quality Issues

If input data has quality problems:

```json
{
  "data_quality_warnings": [
    {
      "type": "low_frequency_resolution",
      "detail": "Only 6 points per octave below 100 Hz",
      "impact": "Modal analysis may miss narrow peaks"
    },
    {
      "type": "possible_measurement_artifact",
      "detail": "Unusual spike at 60 Hz may be electrical noise",
      "impact": "Exclude from room mode analysis"
    }
  ]
}
```

### 3. Always Disclose Assumptions

When analysis depends on assumptions:

```json
{
  "assumptions": [
    {
      "assumption": "Standard atmospheric conditions (20°C, 1 atm)",
      "impact": "Speed of sound calculation for distance estimates"
    },
    {
      "assumption": "Microphone positioned at ear height",
      "impact": "Vertical reflection analysis"
    }
  ]
}
```

---

## Analysis Quality Thresholds

### Minimum Data Requirements

| Analysis Type | Minimum Requirement | If Not Met |
|---------------|---------------------|------------|
| Frequency response | ≥ 10 points per octave | `analysis_confidence: low` |
| Peak detection | ≥ 24 points per octave | `peaks_may_be_missed: true` |
| Impulse analysis | ≥ 44.1 kHz sample rate | `reflection_timing_uncertain: true` |
| Waterfall analysis | ≥ 5 time slices | `decay_estimate_unreliable: true` |

### When to Refuse Analysis

Return an error (not just low confidence) if:

```json
{
  "error": "insufficient_data",
  "reason": "Measurement contains only 3 data points",
  "minimum_required": 50,
  "suggestion": "Re-export measurement with higher resolution"
}
```

---

## Response Format Requirements

### 1. Structured Over Prose

All tool responses must be structured JSON, not prose:

❌ **Prohibited**:
```json
{
  "analysis": "The measurement shows a significant peak around 80 Hz which is probably a room mode. You should consider moving the speaker or adding bass trapping."
}
```

✅ **Required**:
```json
{
  "peaks": [
    {
      "frequency_hz": 82,
      "deviation_db": 7.3,
      "q_factor": 8.2,
      "classification": "likely_room_mode",
      "confidence": "high"
    }
  ],
  "suggested_actions": [
    {
      "type": "placement_adjustment",
      "rationale": "Moving speaker may reduce modal excitation"
    },
    {
      "type": "acoustic_treatment",
      "rationale": "Bass trapping reduces modal energy"
    }
  ]
}
```

### 2. Machine-Parseable Outputs

All numeric values must be actual numbers, not strings:

❌ **Prohibited**:
```json
{
  "frequency": "82 Hz",
  "level": "+7.3 dB"
}
```

✅ **Required**:
```json
{
  "frequency_hz": 82,
  "level_db": 7.3
}
```

### 3. Explicit Units

All values must have explicit units in the key name:

❌ **Prohibited**:
```json
{
  "frequency": 82,
  "time": 3.5,
  "distance": 1.2
}
```

✅ **Required**:
```json
{
  "frequency_hz": 82,
  "time_ms": 3.5,
  "distance_m": 1.2
}
```

---

## Uncertainty Handling

### Confidence Scoring Rules

| Confidence | Criteria |
|------------|----------|
| `high` | Pattern is clear, evidence is strong, conclusion is well-supported |
| `medium` | Pattern is likely, some uncertainty remains |
| `low` | Pattern is possible but could be noise or artifact |
| `uncertain` | Cannot determine from available data |

### Probability Language

Use consistent probability language:

| Term | Meaning |
|------|---------|
| `definitely` | Never use - we don't have certainty |
| `certainly` | Never use |
| `likely` | >70% confidence |
| `possibly` | 30-70% confidence |
| `unlikely` | <30% confidence |
| `cannot_determine` | Insufficient data |

---

## Error Handling

### Input Validation Errors

```json
{
  "error": "validation_error",
  "field": "speaker_id",
  "message": "speaker_id must be one of: L, R, C, Sub, Combined",
  "received": "left"
}
```

### Parse Errors

```json
{
  "error": "parse_error",
  "format_detected": "unknown",
  "message": "Could not parse file as REW text, CSV, or MDAT format",
  "suggestion": "Ensure file is exported from REW using File > Export > Export measurement as text"
}
```

### Analysis Errors

```json
{
  "error": "analysis_error",
  "analysis_type": "room_mode_detection",
  "message": "Insufficient frequency resolution for reliable mode detection",
  "data_quality": {
    "points_per_octave": 6,
    "minimum_required": 12
  }
}
```

---

## Human-in-the-Loop Principle

Every recommendation must be framed as a suggestion for human consideration:

```json
{
  "recommendation": {
    "action": "Consider moving speaker 20-30 cm away from rear wall",
    "expected_outcome": "May reduce null depth at 95 Hz",
    "confidence": "medium",
    "trade_offs": [
      "May affect imaging if asymmetric",
      "Requires re-running GLM calibration"
    ],
    "reversibility": "Fully reversible",
    "human_judgment_required": true
  }
}
```

The `human_judgment_required: true` flag must always be present for any actionable recommendation.
