# Tool: rew.compare_measurements

Compares two or more measurements to identify improvements, regressions, and unchanged characteristics.

## MCP Tool Definition

> **Reference**: MCP Tools Specification (Protocol Version 2025-06-18)
> https://modelcontextprotocol.io/specification/2025-06-18/server/tools

```json
{
  "name": "rew.compare_measurements",
  "title": "Compare Measurements",
  "description": "Compare two or more REW measurements to determine what improved, worsened, or stayed the same. Supports pre/post GLM comparison, placement comparisons, and L/R symmetry analysis.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "measurement_ids": {
        "type": "array",
        "items": { "type": "string" },
        "minItems": 2,
        "maxItems": 10,
        "description": "List of measurement IDs to compare (minimum 2, maximum 10)"
      },
      "comparison_type": {
        "type": "string",
        "enum": ["before_after", "placement_comparison", "lr_symmetry", "with_without_sub"],
        "description": "Type of comparison to perform"
      },
      "reference_measurement_id": {
        "type": "string",
        "description": "Optional: ID of the reference measurement (for before_after, this is 'before')"
      },
      "frequency_range_hz": {
        "type": "array",
        "items": { "type": "number", "minimum": 1, "maximum": 30000 },
        "minItems": 2,
        "maxItems": 2,
        "description": "Optional: Limit analysis to frequency range [min, max] in Hz"
      }
    },
    "required": ["measurement_ids", "comparison_type"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "comparison_id": {
        "type": "string",
        "description": "Unique identifier for this comparison result"
      },
      "comparison_type": {
        "type": "string",
        "enum": ["before_after", "placement_comparison", "lr_symmetry", "with_without_sub"]
      },
      "measurements_compared": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "role": { "type": "string" },
            "condition": { "type": "string" }
          },
          "required": ["id", "role"]
        }
      },
      "frequency_band_analysis": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "band_name": { "type": "string" },
            "frequency_range_hz": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 },
            "reference_avg_db": { "type": "number" },
            "reference_variance_db": { "type": "number" },
            "comparison_avg_db": { "type": "number" },
            "comparison_variance_db": { "type": "number" },
            "level_delta_db": { "type": "number" },
            "variance_delta_db": { "type": "number" },
            "assessment": { "type": "string", "enum": ["improved", "slightly_improved", "unchanged", "slightly_regressed", "regressed"] },
            "assessment_reason": { "type": "string" }
          },
          "required": ["band_name", "frequency_range_hz", "assessment"]
        }
      },
      "peak_analysis": {
        "type": "object",
        "properties": {
          "peaks_in_reference": { "type": "array", "items": { "type": "object" } },
          "peaks_addressed": { "type": "array", "items": { "type": "object" } },
          "peaks_unchanged": { "type": "array", "items": { "type": "object" } },
          "new_peaks": { "type": "array", "items": { "type": "object" } }
        }
      },
      "null_analysis": {
        "type": "object",
        "properties": {
          "nulls_in_reference": { "type": "array", "items": { "type": "object" } },
          "nulls_addressed": { "type": "array", "items": { "type": "object" } },
          "nulls_unchanged": { "type": "array", "items": { "type": "object" } },
          "new_nulls": { "type": "array", "items": { "type": "object" } }
        }
      },
      "overall_assessment": {
        "type": "object",
        "properties": {
          "verdict": { "type": "string", "enum": ["improved", "slightly_improved", "mixed", "slightly_regressed", "regressed"] },
          "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
          "improvement_score": { "type": "number", "minimum": 0, "maximum": 1 },
          "summary": { "type": "object" }
        },
        "required": ["verdict", "confidence"]
      },
      "analysis_confidence": {
        "type": "string",
        "enum": ["high", "medium", "low", "uncertain"]
      },
      "analysis_limitations": {
        "type": "array",
        "items": { "type": "string" }
      },
      "error": {
        "type": "string",
        "description": "Error type if comparison failed"
      },
      "message": {
        "type": "string",
        "description": "Error message if comparison failed"
      }
    },
    "required": ["comparison_type", "analysis_confidence"]
  }
}
```

## Comparison Types

### 1. before_after

For pre-GLM vs post-GLM or before/after treatment comparisons.

- First measurement (or `reference_measurement_id`) is the "before" state
- Subsequent measurements are "after" states
- Reports: peaks addressed, nulls unchanged, overall improvement

### 2. placement_comparison

For comparing different speaker or listener positions.

- All measurements treated equally (no inherent "better" baseline)
- Reports: which placement has smoother response, fewer problems

### 3. lr_symmetry

For comparing left and right speaker measurements.

- Expects exactly 2 measurements (L and R)
- Reports: frequency-by-frequency differences, asymmetry issues

### 4. with_without_sub

For comparing response with and without subwoofer.

- Reports: bass extension, crossover integration, level matching

## Output Specification

### Success Response

```json
{
  "comparison_id": "comp_20240120_001",
  "comparison_type": "before_after",
  "measurements_compared": [
    {
      "id": "meas_pre_glm_L",
      "role": "reference",
      "condition": "pre_glm"
    },
    {
      "id": "meas_post_glm_L", 
      "role": "comparison",
      "condition": "post_glm"
    }
  ],
  
  "frequency_band_analysis": [
    {
      "band_name": "sub_bass",
      "frequency_range_hz": [20, 60],
      "reference_avg_db": 78.5,
      "reference_variance_db": 6.2,
      "comparison_avg_db": 76.2,
      "comparison_variance_db": 3.8,
      "level_delta_db": -2.3,
      "variance_delta_db": -2.4,
      "assessment": "improved",
      "assessment_reason": "Lower variance indicates smoother response"
    },
    {
      "band_name": "bass",
      "frequency_range_hz": [60, 250],
      "reference_avg_db": 77.1,
      "reference_variance_db": 8.4,
      "comparison_avg_db": 74.8,
      "comparison_variance_db": 4.1,
      "level_delta_db": -2.3,
      "variance_delta_db": -4.3,
      "assessment": "improved",
      "assessment_reason": "Significant variance reduction"
    }
  ],
  
  "peak_analysis": {
    "peaks_in_reference": [
      {
        "frequency_hz": 63,
        "deviation_db": 8.5,
        "q_factor": 7.2
      },
      {
        "frequency_hz": 125,
        "deviation_db": 5.8,
        "q_factor": 5.1
      }
    ],
    "peaks_addressed": [
      {
        "frequency_hz": 63,
        "reference_deviation_db": 8.5,
        "comparison_deviation_db": 2.1,
        "reduction_db": 6.4,
        "status": "significantly_reduced"
      },
      {
        "frequency_hz": 125,
        "reference_deviation_db": 5.8,
        "comparison_deviation_db": 1.9,
        "reduction_db": 3.9,
        "status": "reduced"
      }
    ],
    "peaks_unchanged": [],
    "new_peaks": []
  },
  
  "null_analysis": {
    "nulls_in_reference": [
      {
        "frequency_hz": 80,
        "depth_db": -12.4,
        "q_factor": 9.1
      }
    ],
    "nulls_addressed": [],
    "nulls_unchanged": [
      {
        "frequency_hz": 80,
        "reference_depth_db": -12.4,
        "comparison_depth_db": -11.8,
        "change_db": 0.6,
        "status": "unchanged",
        "note": "Deep null unchanged - expected behavior for EQ-based correction"
      }
    ],
    "new_nulls": []
  },
  
  "overall_assessment": {
    "verdict": "improved",
    "confidence": "high",
    "improvement_score": 0.72,
    "summary": {
      "peaks_reduced": 2,
      "peaks_unchanged": 0,
      "peaks_worsened": 0,
      "nulls_reduced": 0,
      "nulls_unchanged": 1,
      "nulls_worsened": 0,
      "variance_change_db": -3.2
    }
  },
  
  "analysis_confidence": "high",
  "analysis_limitations": []
}
```

## Analysis Algorithms

### Frequency Band Comparison

```python
FREQUENCY_BANDS = [
    ('sub_bass', 20, 60),
    ('bass', 60, 250),
    ('low_mid', 250, 500),
    ('mid', 500, 2000),
    ('high_mid', 2000, 6000),
    ('high', 6000, 20000)
]

def compare_frequency_bands(ref: Measurement, comp: Measurement) -> list:
    """Compare measurements across frequency bands."""
    results = []
    
    for name, low, high in FREQUENCY_BANDS:
        ref_data = extract_band(ref, low, high)
        comp_data = extract_band(comp, low, high)
        
        if not ref_data or not comp_data:
            continue
        
        ref_avg = mean(ref_data.spl)
        ref_var = std(ref_data.spl)
        comp_avg = mean(comp_data.spl)
        comp_var = std(comp_data.spl)
        
        level_delta = comp_avg - ref_avg
        var_delta = comp_var - ref_var
        
        # Assess change
        if var_delta < -1.5:
            assessment = 'improved'
            reason = 'Significantly smoother response'
        elif var_delta < -0.5:
            assessment = 'slightly_improved'
            reason = 'Somewhat smoother response'
        elif var_delta > 1.5:
            assessment = 'regressed'
            reason = 'Response became less smooth'
        elif var_delta > 0.5:
            assessment = 'slightly_regressed'
            reason = 'Response slightly less smooth'
        else:
            assessment = 'unchanged'
            reason = 'No significant change'
        
        results.append({
            'band_name': name,
            'frequency_range_hz': [low, high],
            'reference_avg_db': round(ref_avg, 1),
            'reference_variance_db': round(ref_var, 1),
            'comparison_avg_db': round(comp_avg, 1),
            'comparison_variance_db': round(comp_var, 1),
            'level_delta_db': round(level_delta, 1),
            'variance_delta_db': round(var_delta, 1),
            'assessment': assessment,
            'assessment_reason': reason
        })
    
    return results
```

### Peak Tracking

```python
def track_peaks(ref: Measurement, comp: Measurement, 
                ref_peaks: list) -> dict:
    """Track what happened to peaks from reference in comparison."""
    
    addressed = []
    unchanged = []
    
    for peak in ref_peaks:
        freq = peak['frequency_hz']
        ref_dev = peak['deviation_db']
        
        # Find corresponding point in comparison
        comp_dev = get_deviation_at_frequency(comp, freq)
        
        change = comp_dev - ref_dev
        
        if change < -3.0:
            status = 'significantly_reduced'
        elif change < -1.0:
            status = 'reduced'
        elif change > 3.0:
            status = 'worsened'
        elif change > 1.0:
            status = 'slightly_worsened'
        else:
            status = 'unchanged'
        
        result = {
            'frequency_hz': freq,
            'reference_deviation_db': round(ref_dev, 1),
            'comparison_deviation_db': round(comp_dev, 1),
            'reduction_db': round(-change, 1),
            'status': status
        }
        
        if 'reduced' in status:
            addressed.append(result)
        else:
            unchanged.append(result)
    
    # Detect new peaks in comparison
    comp_peaks = detect_peaks(comp)
    new_peaks = []
    for peak in comp_peaks:
        if not peak_exists_near(ref_peaks, peak['frequency_hz'], tolerance_pct=5):
            new_peaks.append(peak)
    
    return {
        'addressed': addressed,
        'unchanged': unchanged,
        'new_peaks': new_peaks
    }
```

### Overall Assessment Scoring

```python
def calculate_overall_assessment(band_results: list, 
                                  peak_results: dict,
                                  null_results: dict) -> dict:
    """Calculate overall comparison assessment."""
    
    # Score components (0-1 scale, higher is better)
    scores = []
    
    # Band variance improvement
    for band in band_results:
        if band['variance_delta_db'] < -2:
            scores.append(1.0)
        elif band['variance_delta_db'] < -1:
            scores.append(0.75)
        elif band['variance_delta_db'] < 0:
            scores.append(0.6)
        elif band['variance_delta_db'] < 1:
            scores.append(0.4)
        else:
            scores.append(0.2)
    
    # Peak reduction bonus
    peaks_addressed = len(peak_results['addressed'])
    peaks_unchanged = len(peak_results['unchanged'])
    peaks_new = len(peak_results['new_peaks'])
    
    if peaks_addressed > 0:
        peak_score = peaks_addressed / (peaks_addressed + peaks_unchanged + peaks_new)
        scores.append(peak_score)
    
    # Calculate final score
    improvement_score = sum(scores) / len(scores) if scores else 0.5
    
    # Determine verdict
    if improvement_score >= 0.7:
        verdict = 'improved'
    elif improvement_score >= 0.55:
        verdict = 'slightly_improved'
    elif improvement_score >= 0.45:
        verdict = 'mixed'
    elif improvement_score >= 0.3:
        verdict = 'slightly_regressed'
    else:
        verdict = 'regressed'
    
    return {
        'verdict': verdict,
        'confidence': 'high' if len(scores) >= 4 else 'medium',
        'improvement_score': round(improvement_score, 2)
    }
```

## L/R Symmetry Analysis

For `comparison_type: "lr_symmetry"`:

```json
{
  "comparison_type": "lr_symmetry",
  "measurements_compared": [
    { "id": "meas_L", "role": "left" },
    { "id": "meas_R", "role": "right" }
  ],
  
  "symmetry_analysis": {
    "overall_match_score": 0.85,
    "frequency_bands": [
      {
        "band_name": "bass",
        "frequency_range_hz": [60, 250],
        "left_avg_db": 76.2,
        "right_avg_db": 75.8,
        "difference_db": 0.4,
        "assessment": "well_matched"
      }
    ],
    "significant_differences": [
      {
        "frequency_hz": 125,
        "left_spl_db": 78.5,
        "right_spl_db": 72.1,
        "difference_db": 6.4,
        "likely_cause": "Room asymmetry or speaker placement difference",
        "severity": "significant"
      }
    ],
    "imaging_impact": {
      "assessment": "minor_concern",
      "note": "6 dB difference at 125 Hz may affect bass imaging"
    }
  }
}
```

## Usage Examples

### Example 1: Pre vs Post GLM

```json
{
  "measurement_ids": ["meas_pre_glm_L", "meas_post_glm_L"],
  "comparison_type": "before_after"
}
```

### Example 2: Placement A vs B

```json
{
  "measurement_ids": ["meas_placement_A", "meas_placement_B"],
  "comparison_type": "placement_comparison"
}
```

### Example 3: L/R Match Check

```json
{
  "measurement_ids": ["meas_L", "meas_R"],
  "comparison_type": "lr_symmetry"
}
```

## Error Conditions

| Error | Cause | Resolution |
|-------|-------|------------|
| `measurement_not_found` | ID doesn't exist | Check measurement IDs |
| `incompatible_measurements` | Different frequency ranges | Use measurements with overlapping ranges |
| `insufficient_measurements` | Less than 2 IDs provided | Provide at least 2 measurement IDs |
