# Tool: rew.interpret_with_glm_context

Interprets analysis results through the lens of Genelec GLM behavior and capabilities.

## MCP Tool Definition

> **Reference**: MCP Tools Specification (Protocol Version 2025-06-18)
> https://modelcontextprotocol.io/specification/2025-06-18/server/tools

```json
{
  "name": "rew.interpret_with_glm_context",
  "title": "Interpret with GLM Context",
  "description": "Interpret measurement analysis results considering Genelec GLM's capabilities and limitations. Explains what GLM can address, what requires physical solutions, and provides calibration-aware recommendations.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "comparison_id": {
        "type": "string",
        "description": "ID from a previous rew.compare_measurements call (for pre/post GLM analysis)"
      },
      "measurement_id": {
        "type": "string",
        "description": "ID of a single measurement to interpret (alternative to comparison_id)"
      },
      "analysis_results": {
        "type": "object",
        "description": "Optional: Direct analysis results to interpret (from room_modes, decay, or impulse analysis)"
      },
      "glm_version": {
        "type": "string",
        "enum": ["glm3", "glm4", "unknown"],
        "default": "unknown",
        "description": "GLM software version if known"
      }
    },
    "oneOf": [
      { "required": ["comparison_id"] },
      { "required": ["measurement_id"] },
      { "required": ["analysis_results"] }
    ]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "interpretation_type": {
        "type": "string",
        "enum": ["pre_post_glm_comparison", "single_measurement", "analysis_interpretation"]
      },
      "glm_version": { "type": "string", "enum": ["glm3", "glm4", "unknown"] },
      "analysis_confidence": { "type": "string", "enum": ["high", "medium", "low", "uncertain"] },
      "glm_effectiveness_assessment": {
        "type": "object",
        "properties": {
          "overall": { "type": "string", "enum": ["excellent", "good", "adequate", "limited", "poor"] },
          "score": { "type": "number", "minimum": 0, "maximum": 1 },
          "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
        }
      },
      "corrections_successfully_applied": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue": { "type": "string" },
            "pre_severity": { "type": "string" },
            "pre_deviation_db": { "type": "number" },
            "post_severity": { "type": "string" },
            "post_deviation_db": { "type": "number" },
            "glm_action": { "type": "string" },
            "effectiveness": { "type": "string", "enum": ["highly_effective", "effective", "partially_effective", "minimal_effect"] },
            "explanation": { "type": "string" }
          },
          "required": ["issue", "glm_action", "effectiveness"]
        }
      },
      "issues_beyond_glm_scope": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue": { "type": "string" },
            "severity": { "type": "string" },
            "measured_depth_db": { "type": "number" },
            "why_glm_cannot_fix": {
              "type": "object",
              "properties": {
                "reason": { "type": "string" },
                "explanation": { "type": "string" },
                "reference": { "type": "string" }
              },
              "required": ["reason", "explanation"]
            },
            "physical_cause_assessment": {
              "type": "object",
              "properties": {
                "likely_cause": { "type": "string" },
                "estimated_path_difference_m": { "type": "number" },
                "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
              }
            },
            "recommended_solutions": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": { "type": "string" },
                  "action": { "type": "string" },
                  "expected_improvement": { "type": "string" },
                  "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
                  "reversible": { "type": "boolean" },
                  "cost": { "type": "string" }
                },
                "required": ["type", "action"]
              }
            }
          },
          "required": ["issue", "severity", "why_glm_cannot_fix"]
        }
      },
      "residual_issues_assessment": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue": { "type": "string" },
            "residual_deviation_db": { "type": "number" },
            "assessment": { "type": "string", "enum": ["acceptable", "borderline", "concerning"] },
            "within_target": { "type": "boolean" },
            "explanation": { "type": "string" }
          }
        }
      },
      "glm_behavior_notes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "observation": { "type": "string" },
            "explanation": { "type": "string" },
            "is_expected": { "type": "boolean" }
          },
          "required": ["observation", "explanation", "is_expected"]
        }
      },
      "decay_interpretation": {
        "type": "object",
        "properties": {
          "applicable": { "type": "boolean" },
          "note": { "type": "string" },
          "implication": { "type": "string" },
          "recommendation": { "type": "string" }
        }
      },
      "reflection_interpretation": {
        "type": "object",
        "properties": {
          "applicable": { "type": "boolean" },
          "note": { "type": "string" },
          "explanation": { "type": "string" },
          "recommendation": { "type": "string" }
        }
      },
      "overall_verdict": {
        "type": "object",
        "properties": {
          "glm_calibration_quality": { "type": "string", "enum": ["excellent", "good", "adequate", "limited", "poor"] },
          "remaining_issues_summary": { "type": "array", "items": { "type": "string" } },
          "system_readiness": { "type": "string", "enum": ["ready", "ready_with_caveats", "needs_attention", "not_ready"] },
          "primary_recommendation": { "type": "string" },
          "acceptance_note": { "type": "string" }
        },
        "required": ["glm_calibration_quality", "system_readiness"]
      },
      "comparison_with_expectations": {
        "type": "object",
        "properties": {
          "assessment": { "type": "string", "enum": ["exceeds_expectations", "meets_expectations", "below_expectations"] },
          "explanation": { "type": "string" }
        }
      },
      "error": { "type": "string" },
      "message": { "type": "string" }
    },
    "required": ["interpretation_type", "analysis_confidence"]
  }
}
```

## Genelec GLM Reference

> **Reference**: Genelec GLM Software documentation
> https://www.genelec.com/glm

### GLM Core Principles (from Genelec documentation)

1. **Cut-only correction**: GLM applies cuts, not boosts (with minor exceptions in HF)
2. **Focus on low frequencies**: Primary correction below ~500 Hz
3. **In-room target**: Targets flat in-room response, not anechoic
4. **Conservative approach**: Avoids aggressive correction of deep nulls

## Output Specification

```json
{
  "interpretation_type": "pre_post_glm_comparison",
  "glm_version": "glm4",
  "analysis_confidence": "high",
  
  "glm_effectiveness_assessment": {
    "overall": "good",
    "score": 0.78,
    "confidence": "high"
  },
  
  "corrections_successfully_applied": [
    {
      "issue": "Room mode peak at 63 Hz",
      "pre_severity": "significant",
      "pre_deviation_db": 8.5,
      "post_severity": "minor",
      "post_deviation_db": 2.1,
      "glm_action": "Applied cut filter",
      "effectiveness": "highly_effective",
      "explanation": "GLM effectively reduced this modal peak by 6.4 dB. This is within GLM's primary operating range and demonstrates typical good correction."
    },
    {
      "issue": "Bass buildup around 125 Hz",
      "pre_severity": "moderate",
      "pre_deviation_db": 5.8,
      "post_severity": "minor",
      "post_deviation_db": 1.9,
      "glm_action": "Applied broadband cut",
      "effectiveness": "effective",
      "explanation": "Broad modal region successfully smoothed. This type of correction is GLM's strength."
    }
  ],
  
  "issues_beyond_glm_scope": [
    {
      "issue": "Deep null at 80 Hz",
      "severity": "significant",
      "measured_depth_db": -12.4,
      "why_glm_cannot_fix": {
        "reason": "Cancellation null",
        "explanation": "GLM does not boost deep nulls. Boosting would require excessive gain, causing distortion, increased power consumption, and potential thermal issues. The null is caused by acoustic cancellation that EQ cannot resolve.",
        "reference": "This is documented GLM behavior - see Genelec GLM design philosophy."
      },
      "physical_cause_assessment": {
        "likely_cause": "Speaker-boundary interference (SBIR)",
        "estimated_path_difference_m": 2.1,
        "confidence": "medium"
      },
      "recommended_solutions": [
        {
          "type": "placement_adjustment",
          "action": "Move speaker 20-40cm away from or toward rear wall",
          "expected_improvement": "Shift null frequency, potentially reducing depth",
          "confidence": "medium",
          "reversible": true,
          "cost": "free"
        },
        {
          "type": "listening_position_adjustment",
          "action": "Move listening position 30-50cm forward or back",
          "expected_improvement": "May move out of null zone",
          "confidence": "medium",
          "reversible": true,
          "cost": "free"
        }
      ]
    }
  ],
  
  "residual_issues_assessment": [
    {
      "issue": "Mild peak at 200 Hz",
      "residual_deviation_db": 2.8,
      "assessment": "acceptable",
      "within_target": true,
      "explanation": "±3 dB deviation is within acceptable range for calibrated systems. GLM intentionally allows small variations to avoid over-processing."
    }
  ],
  
  "glm_behavior_notes": [
    {
      "observation": "Peak at 63 Hz reduced but not eliminated",
      "explanation": "GLM applies conservative correction. Complete elimination might over-correct and cause issues at adjacent frequencies.",
      "is_expected": true
    },
    {
      "observation": "Null at 80 Hz unchanged",
      "explanation": "GLM's cut-only approach means nulls remain. This is by design, not a limitation - boosting nulls creates more problems than it solves.",
      "is_expected": true
    }
  ],
  
  "decay_interpretation": {
    "applicable": true,
    "note": "GLM reduces peak levels but does NOT affect decay times",
    "implication": "If modal ringing was present pre-GLM, it will still be present post-GLM, though potentially less audible due to reduced peak level",
    "recommendation": "For decay issues, acoustic treatment (bass trapping) is required regardless of GLM calibration"
  },
  
  "reflection_interpretation": {
    "applicable": true,
    "note": "GLM cannot address reflection-induced comb filtering",
    "explanation": "Reflections cause time-domain interference that requires physical treatment, not EQ",
    "recommendation": "Address reflections with absorption panels or speaker/listener repositioning"
  },
  
  "overall_verdict": {
    "glm_calibration_quality": "good",
    "remaining_issues_summary": [
      "Deep null at 80 Hz (requires physical solution)",
      "Minor residual variation (acceptable)"
    ],
    "system_readiness": "ready_with_caveats",
    "primary_recommendation": "Consider speaker or listening position adjustment to address 80 Hz null",
    "acceptance_note": "Current state is acceptable for most work. The 80 Hz null may affect bass accuracy in that specific frequency region."
  },
  
  "comparison_with_expectations": {
    "assessment": "meets_expectations",
    "explanation": "GLM performed as expected - addressing correctable issues while leaving physics-limited problems unchanged. This is correct behavior, not a failure."
  }
}
```

## GLM Behavior Rules

### What GLM Fixes Well

| Issue | GLM Response | Typical Improvement |
|-------|--------------|---------------------|
| Room mode peaks | Cut filter | 3-8 dB reduction |
| Broad bass buildup | Broadband cut | 2-5 dB smoothing |
| Level mismatch L/R | Gain adjustment | Match to ±0.5 dB |
| Subwoofer integration | Level + delay | Improved crossover |
| HF roll-off (minor) | Small boost | ≤3 dB |

### What GLM Cannot Fix

| Issue | Why | Solution |
|-------|-----|----------|
| Deep nulls (>10 dB) | Would require excessive boost | Move speaker/listener |
| Comb filtering | Time-domain problem | Treat reflections |
| SBIR nulls | Cancellation physics | Reposition speaker |
| Modal decay/ringing | EQ affects level, not time | Bass trapping |
| Flutter echo | Time-domain | Diffusion/absorption |

### GLM Decision Logic

```python
def interpret_glm_action(issue: dict) -> dict:
    """
    Determine what GLM would do with a given issue.
    """
    issue_type = issue['type']
    severity_db = abs(issue.get('deviation_db', 0))
    
    if issue_type == 'peak':
        if severity_db > 3:
            return {
                'glm_action': 'apply_cut',
                'expected_reduction_db': min(severity_db - 2, 8),  # Conservative
                'confidence': 'high'
            }
        else:
            return {
                'glm_action': 'minor_correction_or_ignore',
                'expected_reduction_db': severity_db * 0.5,
                'confidence': 'medium'
            }
    
    elif issue_type == 'null':
        if severity_db > 10:  # Deep null
            return {
                'glm_action': 'no_correction',
                'reason': 'Deep null - boosting would cause problems',
                'confidence': 'high'
            }
        elif severity_db > 6:
            return {
                'glm_action': 'minimal_boost_or_none',
                'expected_improvement_db': 1,  # Very conservative
                'confidence': 'medium'
            }
        else:
            return {
                'glm_action': 'minor_boost_possible',
                'expected_improvement_db': 2,
                'confidence': 'low'
            }
    
    return {'glm_action': 'unknown', 'confidence': 'low'}
```

## Interpretation Categories

### Category 1: GLM Success

When a peak is reduced post-GLM:

```json
{
  "category": "glm_success",
  "observation": "Peak at 80 Hz reduced from +8 dB to +2 dB",
  "interpretation": "GLM correctly identified and addressed this room mode",
  "user_action": "None required",
  "confidence": "high"
}
```

### Category 2: Expected GLM Limitation

When a null persists post-GLM:

```json
{
  "category": "expected_limitation",
  "observation": "Null at 63 Hz remains at -12 dB post-GLM",
  "interpretation": "GLM correctly did NOT attempt to boost this null. Boosting deep nulls is counterproductive.",
  "is_glm_failure": false,
  "user_action": "Physical solution required (placement or treatment)",
  "confidence": "high"
}
```

### Category 3: Residual Issue (Acceptable)

When small deviation remains:

```json
{
  "category": "residual_acceptable",
  "observation": "Mild 2.5 dB peak at 125 Hz remains",
  "interpretation": "Within ±3 dB target. GLM intentionally uses conservative correction.",
  "is_problem": false,
  "user_action": "None required - within acceptable tolerance",
  "confidence": "high"
}
```

### Category 4: Physical Problem

When issue is beyond any EQ:

```json
{
  "category": "physical_problem",
  "observation": "Comb filtering pattern from 2ms reflection",
  "interpretation": "This is a reflection-induced time-domain problem. No EQ (including GLM) can address it.",
  "glm_relevance": "none",
  "user_action": "Treat reflecting surface or reposition",
  "confidence": "high"
}
```

## GLM Version Differences

### GLM 3 vs GLM 4

| Feature | GLM 3 | GLM 4 |
|---------|-------|-------|
| Measurement points | Single | Multiple (GRADE) |
| Algorithm | Basic AutoCal | Advanced learning |
| Subwoofer control | Basic | Enhanced |
| User presets | Limited | Extensive |

For MCP server purposes, treat both versions similarly for interpretation - the core physics limitations are the same.

## Validation Against GLM Philosophy

Every interpretation should align with GLM's documented philosophy:

1. **Conservative correction**: GLM doesn't over-correct
2. **Cut-preferred**: Boosts are rare and small
3. **Physics respect**: GLM doesn't fight acoustics
4. **Flat target**: In-room flat, not anechoic flat

If an interpretation suggests GLM "should have" boosted a deep null or eliminated all variation, that interpretation is incorrect.

## External References

- Genelec GLM overview: https://www.genelec.com/glm
- Genelec SAM technology: https://www.genelec.com/sam
- GLM calibration principles: Genelec white papers on room calibration
- "The Limits of EQ": https://www.roomeqwizard.com/help/help_en-GB/html/iseqtheanswer.html
