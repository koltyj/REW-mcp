# Tool: rew.analyze_decay

Analyzes waterfall/spectrogram data to identify frequencies with problematic decay times.

## MCP Tool Definition

```json
{
  "name": "rew.analyze_decay",
  "description": "Analyze decay characteristics from waterfall or spectrogram data to identify frequencies with excessive ringing or resonance.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "measurement_id": {
        "type": "string",
        "description": "ID of measurement with waterfall/spectrogram data"
      },
      "frequency_range_hz": {
        "type": "array",
        "items": { "type": "number" },
        "default": [20, 500],
        "description": "Frequency range to analyze [min, max]"
      },
      "decay_threshold_seconds": {
        "type": "number",
        "default": 0.4,
        "description": "T60 threshold above which decay is flagged as problematic"
      }
    },
    "required": ["measurement_id"]
  }
}
```

## REW Waterfall Generation

> **Reference**: REW can generate waterfall data via API or GUI
> See: https://www.roomeqwizard.com/help/help_en-GB/html/api.html

### Waterfall Modes (from REW documentation)

1. **Fourier mode**: Uses windowed FFT analysis
   - Parameters: window type, window width (ms), time range (ms), rise time (ms)
   
2. **Burst decay mode**: Analyzes energy decay in frequency bands
   - Parameters: bandwidth (e.g., "1/3" octave), periods

### REW API Waterfall Generation Example

```json
{
  "command": "Generate waterfall",
  "parameters": {
    "mode": "Fourier",
    "slices": "101",
    "left window type": "Hann",
    "right window type": "Tukey 0.25",
    "window width ms": "300",
    "time range ms": "500",
    "rise time ms": "150",
    "use csd mode": "false",
    "ppo": "48",
    "smoothing": "1/48"
  }
}
```

## Output Specification

```json
{
  "measurement_id": "meas_L_pre_glm",
  "analysis_type": "decay_analysis",
  "analysis_confidence": "high",
  "frequency_range_analyzed_hz": [20, 500],
  
  "decay_data": {
    "source": "waterfall",
    "mode": "fourier",
    "time_range_ms": 500,
    "frequency_resolution_ppo": 48
  },
  
  "problematic_frequencies": [
    {
      "frequency_hz": 63,
      "t60_seconds": 0.72,
      "t30_seconds": 0.35,
      "severity": "significant",
      "threshold_seconds": 0.4,
      "excess_seconds": 0.32,
      "decay_character": "modal_ringing",
      "correlated_peak": {
        "found": true,
        "peak_deviation_db": 7.8,
        "correlation_confidence": "high"
      },
      "likely_cause": "Strong room mode with insufficient damping",
      "glm_impact": "GLM reduces peak level but cannot affect decay time",
      "suggested_mitigation": [
        {
          "type": "treatment",
          "action": "Bass trapping in room corners",
          "expected_improvement": "Reduce T60 by 0.2-0.4 seconds",
          "confidence": "medium"
        }
      ]
    },
    {
      "frequency_hz": 125,
      "t60_seconds": 0.52,
      "t30_seconds": 0.25,
      "severity": "moderate",
      "threshold_seconds": 0.4,
      "excess_seconds": 0.12,
      "decay_character": "modal_ringing",
      "correlated_peak": {
        "found": true,
        "peak_deviation_db": 4.2
      }
    }
  ],
  
  "acceptable_frequencies": [
    {
      "frequency_hz": 40,
      "t60_seconds": 0.38,
      "assessment": "within_target"
    },
    {
      "frequency_hz": 80,
      "t60_seconds": 0.35,
      "assessment": "good_control"
    },
    {
      "frequency_hz": 200,
      "t60_seconds": 0.28,
      "assessment": "well_controlled"
    }
  ],
  
  "frequency_band_summary": [
    {
      "band": "sub_bass",
      "range_hz": [20, 60],
      "avg_t60_seconds": 0.55,
      "assessment": "elevated",
      "target_t60_seconds": 0.4
    },
    {
      "band": "bass",
      "range_hz": [60, 250],
      "avg_t60_seconds": 0.42,
      "assessment": "slightly_elevated",
      "target_t60_seconds": 0.35
    },
    {
      "band": "low_mid",
      "range_hz": [250, 500],
      "avg_t60_seconds": 0.32,
      "assessment": "acceptable",
      "target_t60_seconds": 0.35
    }
  ],
  
  "overall_assessment": {
    "quality": "needs_improvement",
    "primary_issue_hz": 63,
    "dominant_problem": "Low frequency modal ringing",
    "average_bass_t60_seconds": 0.48
  },
  
  "recommendations": [
    {
      "priority": 1,
      "target_frequency_hz": 63,
      "action": "Add bass trapping targeting 63 Hz",
      "type": "treatment",
      "expected_improvement": "Reduce decay time and perceived 'boominess'",
      "confidence": "high",
      "note": "Porous absorbers need significant depth for 63 Hz; consider membrane or Helmholtz resonator traps"
    },
    {
      "priority": 2,
      "target_frequency_hz": 125,
      "action": "Additional corner treatment",
      "type": "treatment",
      "expected_improvement": "Moderate decay reduction",
      "confidence": "medium"
    }
  ],
  
  "glm_note": {
    "message": "GLM calibration reduces peak levels but does not affect decay times",
    "implication": "Room treatment is recommended for decay issues regardless of GLM use",
    "affected_frequencies": [63, 125]
  }
}
```

## Analysis Algorithms

### T60 Estimation from Waterfall

```python
def estimate_t60_at_frequency(waterfall: WaterfallData, 
                               target_freq_hz: float) -> dict:
    """
    Estimate T60 (time for 60 dB decay) at a specific frequency.
    
    Uses linear regression on the decay curve.
    If 60 dB decay is not measurable, extrapolates from T30 or T20.
    """
    # Find frequency bin closest to target
    freq_idx = find_nearest_index(waterfall.frequencies_hz, target_freq_hz)
    
    # Extract decay curve at this frequency
    times_ms = waterfall.time_slices_ms
    levels_db = [slice_data[freq_idx] for slice_data in waterfall.levels_db]
    
    # Normalize to initial level
    initial_level = levels_db[0]
    normalized_levels = [l - initial_level for l in levels_db]
    
    # Find usable decay range (above noise floor)
    # Assume noise floor is approximately -60 dB from peak
    noise_floor = -60
    valid_points = [(t, l) for t, l in zip(times_ms, normalized_levels) 
                    if l > noise_floor]
    
    if len(valid_points) < 5:
        return {'t60_seconds': None, 'confidence': 'insufficient_data'}
    
    # Linear regression on dB decay
    times = [p[0] for p in valid_points]
    levels = [p[1] for p in valid_points]
    
    slope, intercept = linear_regression(times, levels)
    
    if slope >= 0:
        return {'t60_seconds': None, 'confidence': 'not_decaying'}
    
    # T60 = time to decay 60 dB
    # slope is dB/ms, so T60 = -60 / slope (in ms)
    t60_ms = -60 / slope
    t60_seconds = t60_ms / 1000
    
    # Also calculate T30 for cross-check
    t30_ms = -30 / slope
    t30_seconds = t30_ms / 1000
    
    # Assess quality of fit
    r_squared = calculate_r_squared(times, levels, slope, intercept)
    confidence = 'high' if r_squared > 0.9 else 'medium' if r_squared > 0.7 else 'low'
    
    return {
        't60_seconds': round(t60_seconds, 2),
        't30_seconds': round(t30_seconds, 2),
        'slope_db_per_second': round(slope * 1000, 1),
        'r_squared': round(r_squared, 3),
        'confidence': confidence
    }
```

### Decay Classification

```python
def classify_decay(t60_seconds: float, frequency_hz: float) -> dict:
    """
    Classify decay time quality based on frequency and typical targets.
    
    Targets based on control room standards:
    - Bass (< 200 Hz): T60 ≈ 0.3-0.4s ideal
    - Midrange (200-2000 Hz): T60 ≈ 0.2-0.3s ideal
    """
    
    # Frequency-dependent targets
    if frequency_hz < 80:
        target_t60 = 0.4
        tolerance = 0.15
    elif frequency_hz < 200:
        target_t60 = 0.35
        tolerance = 0.1
    elif frequency_hz < 500:
        target_t60 = 0.3
        tolerance = 0.1
    else:
        target_t60 = 0.25
        tolerance = 0.08
    
    excess = t60_seconds - target_t60
    
    if excess > tolerance * 2:
        severity = 'significant'
        assessment = 'excessive_ringing'
    elif excess > tolerance:
        severity = 'moderate'
        assessment = 'elevated'
    elif excess > 0:
        severity = 'minor'
        assessment = 'slightly_elevated'
    else:
        severity = 'none'
        assessment = 'acceptable'
    
    return {
        'severity': severity,
        'assessment': assessment,
        'target_t60_seconds': target_t60,
        'excess_seconds': round(max(0, excess), 2)
    }
```

### Decay Character Classification

```python
def classify_decay_character(t60: float, q_factor: float, 
                              has_peak_correlation: bool) -> str:
    """
    Classify the character of the decay.
    """
    if has_peak_correlation and q_factor and q_factor > 5:
        return 'modal_ringing'  # Classic room mode resonance
    
    if t60 > 0.6 and has_peak_correlation:
        return 'severe_resonance'
    
    if t60 > 0.5:
        return 'extended_decay'
    
    return 'normal_decay'
```

### Correlate with Frequency Response Peaks

```python
def correlate_decay_with_peaks(problematic_freq_hz: float,
                                peaks: list,
                                tolerance_percent: float = 10) -> dict:
    """
    Check if a problematic decay frequency corresponds to a FR peak.
    """
    for peak in peaks:
        peak_freq = peak['frequency_hz']
        error = abs(problematic_freq_hz - peak_freq) / peak_freq * 100
        
        if error <= tolerance_percent:
            return {
                'found': True,
                'peak_deviation_db': peak['deviation_db'],
                'correlation_confidence': 'high' if error < 5 else 'medium'
            }
    
    return {'found': False}
```

## Target Decay Times

### Small Control Room Standards

| Frequency Range | Target T60 | Acceptable Range |
|-----------------|------------|------------------|
| 20-80 Hz | 0.35-0.45 s | 0.3-0.5 s |
| 80-200 Hz | 0.30-0.40 s | 0.25-0.45 s |
| 200-500 Hz | 0.25-0.35 s | 0.2-0.4 s |
| 500-2000 Hz | 0.20-0.30 s | 0.15-0.35 s |

### Decay Quality Assessment

| T60 vs Target | Assessment |
|---------------|------------|
| Within target | Good control |
| +0.1s over | Slightly elevated |
| +0.2s over | Elevated - consider treatment |
| +0.3s over | Excessive - treatment recommended |
| +0.4s+ over | Severe - treatment essential |

## Treatment Recommendations

### Bass Trapping Effectiveness

| Trap Type | Effective Range | Depth Required |
|-----------|-----------------|----------------|
| Porous absorber | > 100 Hz | ≥ 10 cm for 100 Hz |
| Membrane trap | 40-100 Hz | Varies by design |
| Helmholtz resonator | Specific frequency | Tuned design |
| Corner bass trap | 40-200 Hz | Large, floor-to-ceiling |

### GLM Limitation Note

From Genelec GLM documentation:
- GLM applies magnitude-only correction
- EQ cannot reduce decay time
- Reducing peak level makes decay less audible but doesn't eliminate it

## External References

- RT60 measurement: https://www.roomeqwizard.com/help/help_en-GB/html/graph_rt60.html
- Waterfall generation: https://www.roomeqwizard.com/help/help_en-GB/html/graph_waterfall.html
- REW API waterfall: https://www.roomeqwizard.com/help/help_en-GB/html/api.html#waterfall
- Acoustic treatment: F. Alton Everest, "Master Handbook of Acoustics"
