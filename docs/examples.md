# Usage Examples

This document provides example LLM interaction patterns and expected MCP server responses.

---

## Example 1: Basic Measurement Ingestion

### User Intent
"Load my pre-GLM measurement for the left speaker"

### LLM Tool Call

```json
{
  "tool": "rew.ingest_measurement",
  "arguments": {
    "file_contents": "* Measurement data saved by REW V5.31\n* Source: Measurement 1\n...",
    "metadata": {
      "speaker_id": "L",
      "condition": "pre_glm",
      "mic_position_id": "listening_position_1",
      "notes": "Left speaker, no GLM, default placement"
    }
  }
}
```

### MCP Server Response

```json
{
  "status": "success",
  "measurement_id": "meas_20240115_001",
  "summary": {
    "frequency_range_hz": [20, 20000],
    "data_points": 512,
    "points_per_octave": 48,
    "has_phase_data": true,
    "has_impulse_data": false,
    "overall_level_db": 75.3,
    "data_quality": "high"
  },
  "quick_stats": {
    "bass_region_avg_db": 78.2,
    "midrange_avg_db": 75.1,
    "variance_20_200hz_db": 8.4,
    "variance_200_2000hz_db": 3.2
  }
}
```

---

## Example 2: Pre-GLM vs Post-GLM Comparison

### User Intent
"Compare my pre-GLM and post-GLM measurements and tell me what GLM fixed"

### LLM Tool Calls (Sequential)

**Step 1**: Compare measurements

```json
{
  "tool": "rew.compare_measurements",
  "arguments": {
    "measurement_ids": ["meas_pre_glm_L", "meas_post_glm_L"],
    "comparison_type": "before_after"
  }
}
```

**Response**:

```json
{
  "comparison_id": "comp_001",
  "measurement_a": {
    "id": "meas_pre_glm_L",
    "condition": "pre_glm"
  },
  "measurement_b": {
    "id": "meas_post_glm_L",
    "condition": "post_glm"
  },
  "frequency_bands": [
    {
      "band": "sub_bass",
      "range_hz": [20, 60],
      "level_delta_db": -2.1,
      "variance_delta_db": -1.8,
      "assessment": "improved"
    },
    {
      "band": "bass",
      "range_hz": [60, 250],
      "level_delta_db": -3.5,
      "variance_delta_db": -4.2,
      "assessment": "improved"
    },
    {
      "band": "low_mid",
      "range_hz": [250, 500],
      "level_delta_db": -0.8,
      "variance_delta_db": -0.5,
      "assessment": "slightly_improved"
    },
    {
      "band": "mid",
      "range_hz": [500, 2000],
      "level_delta_db": 0.2,
      "variance_delta_db": 0.1,
      "assessment": "no_significant_change"
    }
  ],
  "peaks_addressed": [
    {
      "frequency_hz": 63,
      "pre_deviation_db": 9.2,
      "post_deviation_db": 2.8,
      "reduction_db": 6.4,
      "confidence": "high"
    },
    {
      "frequency_hz": 125,
      "pre_deviation_db": 6.1,
      "post_deviation_db": 1.9,
      "reduction_db": 4.2,
      "confidence": "high"
    }
  ],
  "nulls_unchanged": [
    {
      "frequency_hz": 80,
      "pre_depth_db": -11.3,
      "post_depth_db": -10.8,
      "change_db": 0.5,
      "note": "Deep null unchanged (expected - GLM does not boost)"
    }
  ],
  "overall_assessment": {
    "verdict": "improved",
    "improvement_score": 0.72,
    "confidence": "high"
  }
}
```

**Step 2**: Interpret with GLM context

```json
{
  "tool": "rew.interpret_with_glm_context",
  "arguments": {
    "comparison_id": "comp_001"
  }
}
```

**Response**:

```json
{
  "glm_effectiveness_assessment": {
    "overall": "good",
    "confidence": "high"
  },
  "corrections_applied": [
    {
      "issue": "Room mode at 63 Hz",
      "pre_severity": "significant",
      "post_severity": "minor",
      "glm_action": "Applied cut filter",
      "result": "Effectively controlled"
    },
    {
      "issue": "Bass buildup around 125 Hz",
      "pre_severity": "moderate",
      "post_severity": "minimal",
      "glm_action": "Applied broadband cut",
      "result": "Well controlled"
    }
  ],
  "issues_beyond_glm_scope": [
    {
      "issue": "Deep null at 80 Hz",
      "severity": "significant",
      "depth_db": -10.8,
      "why_glm_cannot_fix": "GLM does not boost deep nulls (would cause distortion and power waste)",
      "recommended_approach": "placement_adjustment",
      "specific_suggestion": "Moving listening position 30-50cm forward or back may reduce null depth"
    }
  ],
  "residual_issues": [
    {
      "issue": "Mild peak at 200 Hz",
      "severity": "minor",
      "deviation_db": 2.8,
      "assessment": "Within acceptable range (±3 dB)",
      "action_needed": false
    }
  ],
  "verdict": {
    "summary": "GLM calibration successful for addressable issues",
    "remaining_concerns": ["Deep null at 80 Hz requires physical solution"],
    "overall_quality": "good",
    "recommended_next_step": "Consider placement experiment to address 80 Hz null"
  }
}
```

---

## Example 3: Room Mode Analysis

### User Intent
"Analyze my room modes and tell me what's causing the problems"

### LLM Tool Call

```json
{
  "tool": "rew.analyze_room_modes",
  "arguments": {
    "measurement_id": "meas_pre_glm_L",
    "room_dimensions_m": {
      "length": 5.2,
      "width": 3.8,
      "height": 2.6
    }
  }
}
```

### MCP Server Response

```json
{
  "analysis_confidence": "high",
  "detected_issues": [
    {
      "type": "peak",
      "frequency_hz": 66,
      "deviation_db": 8.7,
      "q_factor": 7.2,
      "classification": "room_mode",
      "mode_correlation": {
        "theoretical_mode_hz": 65.9,
        "mode_type": "axial",
        "dimension": "length",
        "order": 2,
        "match_confidence": "high"
      }
    },
    {
      "type": "null",
      "frequency_hz": 82,
      "depth_db": -12.4,
      "q_factor": 9.1,
      "classification": "likely_sbir",
      "estimated_path_length_m": 2.1,
      "possible_cause": "Quarter-wave cancellation from rear wall",
      "confidence": "medium"
    },
    {
      "type": "peak",
      "frequency_hz": 132,
      "deviation_db": 5.4,
      "q_factor": 5.8,
      "classification": "room_mode",
      "mode_correlation": {
        "theoretical_mode_hz": 131.7,
        "mode_type": "axial",
        "dimension": "length",
        "order": 4,
        "match_confidence": "high"
      }
    }
  ],
  "theoretical_room_modes": [
    {
      "frequency_hz": 33.0,
      "type": "axial",
      "dimension": "length",
      "order": 1
    },
    {
      "frequency_hz": 45.1,
      "type": "axial",
      "dimension": "width",
      "order": 1
    },
    {
      "frequency_hz": 65.9,
      "type": "axial",
      "dimension": "length",
      "order": 2
    },
    {
      "frequency_hz": 66.0,
      "type": "axial",
      "dimension": "height",
      "order": 1
    }
  ],
  "mode_density_assessment": {
    "schroeder_frequency_hz": 180,
    "mode_clustering": [
      {
        "frequency_range_hz": [64, 68],
        "modes_count": 3,
        "assessment": "problematic_cluster",
        "expected_behavior": "Strong peak with complex decay"
      }
    ]
  },
  "summary": {
    "primary_issues": [
      "Strong modal buildup around 66 Hz (length mode + height mode overlap)",
      "Deep cancellation null at 82 Hz (likely SBIR)"
    ],
    "addressable_by_glm": ["66 Hz peak can be reduced"],
    "requires_physical_solution": ["82 Hz null"],
    "overall_room_quality": "moderate"
  }
}
```

---

## Example 4: Placement Comparison

### User Intent
"I moved the speakers - compare the old and new positions"

### LLM Tool Calls

```json
{
  "tool": "rew.compare_measurements",
  "arguments": {
    "measurement_ids": ["meas_placement_A", "meas_placement_B"],
    "comparison_type": "placement_comparison"
  }
}
```

### MCP Server Response

```json
{
  "comparison_type": "placement_comparison",
  "placement_a": {
    "id": "meas_placement_A",
    "notes": "Original position, 50cm from rear wall"
  },
  "placement_b": {
    "id": "meas_placement_B",
    "notes": "New position, 80cm from rear wall"
  },
  "improvements_in_b": [
    {
      "description": "Reduced SBIR null",
      "frequency_hz": 95,
      "placement_a_db": -14.2,
      "placement_b_db": -6.8,
      "improvement_db": 7.4,
      "significance": "major_improvement"
    },
    {
      "description": "Smoother bass response",
      "metric": "variance_40_150hz",
      "placement_a_db": 9.2,
      "placement_b_db": 5.8,
      "improvement_db": 3.4,
      "significance": "moderate_improvement"
    }
  ],
  "regressions_in_b": [
    {
      "description": "Slight increase in 60 Hz peak",
      "frequency_hz": 60,
      "placement_a_db": 5.1,
      "placement_b_db": 6.8,
      "change_db": 1.7,
      "significance": "minor_regression",
      "note": "Addressable by GLM"
    }
  ],
  "unchanged": [
    {
      "description": "Modal peak at 125 Hz",
      "frequency_hz": 125,
      "placement_a_db": 4.2,
      "placement_b_db": 4.5,
      "assessment": "No significant change"
    }
  ],
  "verdict": {
    "better_placement": "B",
    "confidence": "high",
    "primary_reasons": [
      "Significant reduction in SBIR null (-7.4 dB improvement)",
      "Overall smoother bass response"
    ],
    "caveats": [
      "Minor increase in 60 Hz peak (addressable by GLM)",
      "Analysis based on single mic position"
    ],
    "recommendation": "Proceed with Placement B and run GLM calibration"
  }
}
```

---

## Example 5: Early Reflection Analysis

### User Intent
"Check for problematic early reflections"

### LLM Tool Call

```json
{
  "tool": "rew.analyze_impulse",
  "arguments": {
    "measurement_id": "meas_with_ir"
  }
}
```

### MCP Server Response

```json
{
  "analysis_type": "impulse_response",
  "analysis_confidence": "high",
  "direct_sound": {
    "time_ms": 0.0,
    "level_db": 0.0
  },
  "early_reflections": [
    {
      "time_ms": 2.1,
      "level_relative_db": -8.2,
      "estimated_path_length_m": 0.72,
      "likely_source": "desk_or_console",
      "severity": "significant",
      "expected_effect": "Comb filtering around 240 Hz and harmonics"
    },
    {
      "time_ms": 4.5,
      "level_relative_db": -12.4,
      "estimated_path_length_m": 1.54,
      "likely_source": "floor_bounce",
      "severity": "moderate",
      "expected_effect": "Some coloration in midrange"
    },
    {
      "time_ms": 6.8,
      "level_relative_db": -14.1,
      "estimated_path_length_m": 2.33,
      "likely_source": "side_wall",
      "severity": "minor",
      "expected_effect": "Minimal impact"
    }
  ],
  "itd_gap_ms": 8.2,
  "itd_assessment": {
    "quality": "acceptable",
    "note": "Initial time delay gap of 8.2ms provides reasonable separation between direct and reflected sound"
  },
  "comb_filtering_risk": {
    "level": "moderate",
    "primary_concern": "Desk reflection at 2.1ms",
    "affected_frequencies": [240, 480, 720, 960],
    "pattern": "Harmonically related dips"
  },
  "recommendations": [
    {
      "priority": 1,
      "issue": "Strong desk reflection",
      "action": "Add absorption on desk surface between speakers and listener",
      "expected_improvement": "Reduce 2.1ms reflection by 6-10 dB",
      "confidence": "high"
    },
    {
      "priority": 2,
      "issue": "Floor bounce",
      "action": "Consider absorption under listening position",
      "expected_improvement": "Reduce 4.5ms reflection",
      "confidence": "medium",
      "note": "May not be necessary if desk reflection is addressed"
    }
  ]
}
```

---

## Example 6: Decay Analysis

### User Intent
"My bass sounds boomy - check the decay"

### LLM Tool Call

```json
{
  "tool": "rew.analyze_decay",
  "arguments": {
    "measurement_id": "meas_with_waterfall",
    "frequency_range_hz": [30, 200]
  }
}
```

### MCP Server Response

```json
{
  "analysis_type": "decay_analysis",
  "analysis_confidence": "high",
  "frequency_range_analyzed_hz": [30, 200],
  "problematic_frequencies": [
    {
      "frequency_hz": 63,
      "t60_seconds": 0.72,
      "severity": "significant",
      "assessment": "Excessive ringing",
      "threshold_seconds": 0.4,
      "correlated_peak": {
        "found": true,
        "deviation_db": 7.8
      }
    },
    {
      "frequency_hz": 80,
      "t60_seconds": 0.55,
      "severity": "moderate",
      "assessment": "Above target",
      "threshold_seconds": 0.4
    }
  ],
  "acceptable_frequencies": [
    {
      "frequency_hz": 40,
      "t60_seconds": 0.38,
      "assessment": "Within target"
    },
    {
      "frequency_hz": 100,
      "t60_seconds": 0.32,
      "assessment": "Good control"
    }
  ],
  "overall_decay_assessment": {
    "quality": "poor_in_bass",
    "primary_problem_hz": 63,
    "average_t60_below_100hz": 0.52
  },
  "correlation_with_modes": {
    "63hz_decay": {
      "correlates_with_peak": true,
      "modal_origin": "likely",
      "note": "Long decay and high peak at 63 Hz indicate strong modal excitation"
    }
  },
  "recommendations": [
    {
      "action": "Add bass trapping in room corners",
      "target_frequency_hz": 63,
      "expected_improvement": "Reduce T60 by 0.2-0.3 seconds",
      "confidence": "high",
      "note": "Porous absorbers effective above 80 Hz; membrane/resonant traps better for 63 Hz"
    },
    {
      "action": "Consider speaker repositioning",
      "rationale": "Moving speaker away from modal antinode may reduce excitation",
      "confidence": "medium"
    }
  ],
  "glm_note": "GLM can reduce the 63 Hz peak level but cannot address the decay time. Bass trapping is recommended regardless of GLM use."
}
```

---

## Response Structure Summary

All MCP server responses follow this general structure:

```json
{
  "analysis_type": "string",
  "analysis_confidence": "high | medium | low | uncertain",
  
  "data_quality_warnings": [],
  "assumptions": [],
  
  "[analysis_results]": {},
  
  "recommendations": [
    {
      "priority": 1,
      "action": "string",
      "expected_improvement": "string",
      "confidence": "high | medium | low",
      "human_judgment_required": true
    }
  ],
  
  "glm_relevance": {
    "addressable_by_glm": [],
    "requires_physical_solution": []
  }
}
```

The LLM is responsible for:
1. Explaining these results in natural language
2. Prioritizing recommendations based on user context
3. Asking clarifying questions if needed
4. Suggesting next measurement steps
