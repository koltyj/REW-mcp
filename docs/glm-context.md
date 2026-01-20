# Genelec GLM Context

This document describes Genelec GLM (Loudspeaker Manager) behavior to enable accurate interpretation of measurements taken before and after GLM calibration.

## What GLM Does

Genelec GLM is an automatic room calibration system that:

1. Measures frequency response at the listening position
2. Applies corrective EQ filters to the speakers
3. Manages level matching across multiple speakers
4. Controls subwoofer integration

## GLM Design Philosophy

Understanding GLM's design philosophy is critical for accurate interpretation:

### 1. Conservative Correction

GLM applies **cuts only, never boosts** (with rare exceptions for high frequencies).

**Why this matters**:
- Peaks are reduced
- Nulls are NOT filled in
- Deep nulls (>10-15 dB) are left untouched

**Interpretation rule**: If a null exists post-GLM, it existed pre-GLM. GLM did not cause it.

### 2. Focus on Low and Low-Mid Frequencies

GLM prioritizes correction in the **low and low-mid frequency range** (primarily below ~1 kHz) where:
- Room modes dominate
- Correction is most effective
- Human hearing is less sensitive to small changes

Per Genelec documentation: "compensation targeting low and low-mid frequencies to minimise the detrimental room acoustic anomalies"

**Why this matters**:
- High frequency issues may remain unchanged
- Speaker placement affects HF more than GLM can correct
- Full audible spectrum capability exists, but focus is on bass region

### 3. In-Room Target Response

GLM targets a **flat in-room response** by default, not anechoic flat.

The default target includes:
- Slight bass rise (room gain compensation)
- Natural high-frequency rolloff

**Optional tilt**: Users can apply a gentle downward tilt (e.g., -2 dB/decade) for a warmer sound.

### 4. Minimum Phase Correction

GLM applies **minimum phase** filters only:
- Cannot correct time-domain issues
- Cannot fix comb filtering from reflections
- Phase response changes only as a consequence of magnitude changes

**Interpretation rule**: If timing/reflection issues exist, GLM cannot address them.

---

## What GLM Can Fix

| Issue | GLM Effectiveness | Notes |
|-------|------------------|-------|
| Room mode peaks | ✅ Effective | Primary strength |
| Bass buildup | ✅ Effective | Applies cuts |
| Level mismatch between speakers | ✅ Effective | Level matching feature |
| Subwoofer integration | ✅ Effective | Crossover + level |
| Broad frequency response tilt | ✅ Effective | Overall EQ |
| Narrow peaks (Q > 10) | ⚠️ Partially | May not fully address |
| Mild dips (< 6 dB) | ⚠️ Partially | May apply slight boost |

---

## What GLM Cannot Fix

| Issue | Why GLM Can't Fix | Solution |
|-------|------------------|----------|
| Deep nulls (> 10 dB) | Would require excessive boost | Move speaker or listener |
| Comb filtering from reflections | Time-domain problem | Treat reflection surface |
| SBIR (speaker boundary interference) | Cancellation physics | Move speaker away from wall |
| Flutter echo | Time-domain problem | Add diffusion/absorption |
| Modal ringing (decay) | EQ doesn't affect decay | Add bass trapping |
| High frequency beaming | Physical speaker behavior | Adjust toe-in or position |

---

## GLM Calibration Quality Indicators

When comparing pre-GLM and post-GLM measurements, look for these indicators of successful calibration:

### Good Calibration Signs

1. **Peak reduction**: Peaks above 200 Hz reduced by 3-6 dB
2. **Smoother response**: Overall variance reduced
3. **Balanced channels**: L/R response more similar
4. **Bass control**: 40-120 Hz region smoothed

### Concerning Signs

1. **Nulls unchanged**: Expected, but problematic if severe
2. **New issues**: Rare, but indicates measurement problems
3. **Overcorrection**: Response too flat below 40 Hz (may sound thin)
4. **Asymmetry remains**: L/R significantly different post-GLM

---

## Interpretation Rules for MCP Server

### Rule 1: Attribute Improvements Correctly

When a peak is reduced post-GLM:
```json
{
  "observation": "Peak at 80 Hz reduced from +8 dB to +2 dB",
  "attribution": "GLM correction (likely)",
  "confidence": "high",
  "reasoning": "This is within GLM's typical correction range and frequency band"
}
```

### Rule 2: Explain Persistent Issues

When a null remains post-GLM:
```json
{
  "observation": "Null at 63 Hz remains at -12 dB",
  "attribution": "Physical acoustics (not addressable by GLM)",
  "confidence": "high",
  "reasoning": "GLM does not boost deep nulls. This is caused by room acoustics or speaker placement.",
  "suggested_action": "Consider speaker or listener position adjustment"
}
```

### Rule 3: Identify GLM Limitations Honestly

When an issue is beyond GLM's scope:
```json
{
  "observation": "Early reflection at 3.2 ms causing comb filtering",
  "attribution": "Reflection (GLM cannot address)",
  "confidence": "high",
  "reasoning": "GLM applies magnitude-only correction. Reflection-induced comb filtering requires acoustic treatment or repositioning.",
  "suggested_action": "Treat reflecting surface or move speaker/listener"
}
```

### Rule 4: Distinguish Placement vs Treatment Decisions

```json
{
  "issue": "Severe null at 50 Hz",
  "depth_db": -15,
  "glm_addressable": false,
  "solutions": [
    {
      "type": "placement",
      "action": "Move listening position 30-50 cm forward or back",
      "effectiveness": "high",
      "reasoning": "Null zones are position-dependent"
    },
    {
      "type": "treatment",
      "action": "Add bass trapping in corners",
      "effectiveness": "medium",
      "reasoning": "Reduces modal energy but may not eliminate null"
    }
  ],
  "recommendation": "Try placement adjustment first (reversible, free)"
}
```

---

## Common GLM Misconceptions

### Misconception 1: "GLM should make the response perfectly flat"

**Reality**: GLM targets flat, but cannot overcome physics. Expect ±3 dB variation post-GLM in well-positioned systems.

### Misconception 2: "My null got worse after GLM"

**Reality**: Unlikely. More likely the null was revealed when surrounding peaks were reduced. GLM rarely makes things worse.

### Misconception 3: "GLM can fix any room"

**Reality**: GLM optimizes within constraints. A poorly positioned speaker in an untreated room will still have issues.

### Misconception 4: "If GLM didn't fix it, the speaker is broken"

**Reality**: Most post-GLM issues are room acoustics or placement problems, not speaker defects.

---

## Pre-GLM vs Post-GLM Analysis Template

When the MCP server compares pre-GLM and post-GLM measurements, structure the analysis as:

```json
{
  "comparison_type": "pre_glm_vs_post_glm",
  "overall_assessment": "improved | mixed | no_change | degraded",
  
  "glm_successes": [
    {
      "frequency_hz": 80,
      "issue_type": "peak",
      "pre_deviation_db": 8.5,
      "post_deviation_db": 2.1,
      "improvement_db": 6.4
    }
  ],
  
  "persistent_issues": [
    {
      "frequency_hz": 63,
      "issue_type": "null",
      "severity_db": -12,
      "glm_addressable": false,
      "suggested_resolution": "placement_adjustment"
    }
  ],
  
  "placement_recommendations": [
    {
      "action": "Move speaker 15 cm away from rear wall",
      "expected_benefit": "Reduce SBIR null at 95 Hz",
      "confidence": "medium"
    }
  ],
  
  "treatment_recommendations": [
    {
      "action": "Add corner bass trap",
      "expected_benefit": "Reduce decay time at 63 Hz",
      "confidence": "medium"
    }
  ],
  
  "acceptance_recommendation": {
    "verdict": "acceptable | needs_adjustment | significant_issues",
    "reasoning": "Response is within ±3 dB from 40-200 Hz. Remaining issues are minor."
  }
}
```

---

## GLM Version Considerations

Different GLM versions have different capabilities:

| Feature | GLM 3 | GLM 4 |
|---------|-------|-------|
| AutoCal precision | Good | Better |
| Multi-point measurement | No | Yes |
| Learning algorithm | Basic | Advanced |
| Subwoofer control | Basic | Advanced |

The MCP server does not need to distinguish GLM versions, but should note if the user provides version information.
