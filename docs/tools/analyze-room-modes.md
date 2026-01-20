# Tool: rew.analyze_room_modes

Detects peaks, nulls, and correlates them with theoretical room modes.

## MCP Tool Definition

```json
{
  "name": "rew.analyze_room_modes",
  "description": "Analyze a measurement for room modes, peaks, and nulls. Optionally correlates detected issues with theoretical room modes based on room dimensions.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "measurement_id": {
        "type": "string",
        "description": "ID of the measurement to analyze"
      },
      "room_dimensions_m": {
        "type": "object",
        "properties": {
          "length": { "type": "number", "description": "Room length in meters" },
          "width": { "type": "number", "description": "Room width in meters" },
          "height": { "type": "number", "description": "Room height in meters" }
        },
        "description": "Optional: Room dimensions for theoretical mode calculation"
      },
      "analysis_options": {
        "type": "object",
        "properties": {
          "peak_threshold_db": {
            "type": "number",
            "default": 5.0,
            "description": "Minimum dB above local average to flag as peak"
          },
          "null_threshold_db": {
            "type": "number",
            "default": -6.0,
            "description": "Minimum dB below local average to flag as null"
          },
          "frequency_range_hz": {
            "type": "array",
            "items": { "type": "number" },
            "default": [20, 300],
            "description": "Frequency range for mode analysis"
          }
        }
      }
    },
    "required": ["measurement_id"]
  }
}
```

## Room Mode Physics

### Axial Mode Formula

Room modes occur at frequencies determined by room dimensions:

```
f = (c / 2) × (n / L)

where:
  f = mode frequency (Hz)
  c = speed of sound (343 m/s at 20°C)
  n = mode order (1, 2, 3, ...)
  L = room dimension (meters)
```

### Mode Types

| Type | Description | Formula |
|------|-------------|---------|
| Axial | One dimension | `f = c/2 × (p/L or q/W or r/H)` |
| Tangential | Two dimensions | `f = c/2 × √((p/L)² + (q/W)²)` |
| Oblique | Three dimensions | `f = c/2 × √((p/L)² + (q/W)² + (r/H)²)` |

Axial modes are typically strongest and most problematic.

## Output Specification

```json
{
  "measurement_id": "meas_L_pre_glm",
  "analysis_type": "room_mode_analysis",
  "analysis_confidence": "high",
  
  "detected_peaks": [
    {
      "frequency_hz": 66,
      "level_db": 82.3,
      "deviation_db": 8.7,
      "q_factor": 7.2,
      "classification": {
        "type": "room_mode",
        "confidence": "high",
        "reasoning": "Narrow peak (Q=7.2) at frequency matching axial mode"
      },
      "mode_correlation": {
        "theoretical_mode_hz": 65.9,
        "mode_type": "axial",
        "dimension": "length",
        "order": 2,
        "match_error_percent": 0.15
      },
      "severity": "significant",
      "glm_addressable": true
    },
    {
      "frequency_hz": 132,
      "level_db": 78.5,
      "deviation_db": 5.4,
      "q_factor": 5.8,
      "classification": {
        "type": "room_mode",
        "confidence": "high",
        "reasoning": "Harmonic of 66 Hz mode (2nd harmonic)"
      },
      "mode_correlation": {
        "theoretical_mode_hz": 131.7,
        "mode_type": "axial",
        "dimension": "length",
        "order": 4,
        "match_error_percent": 0.23
      },
      "severity": "moderate",
      "glm_addressable": true
    }
  ],
  
  "detected_nulls": [
    {
      "frequency_hz": 82,
      "level_db": 61.2,
      "depth_db": -12.4,
      "q_factor": 9.1,
      "classification": {
        "type": "sbir",
        "confidence": "medium",
        "reasoning": "Deep narrow null consistent with speaker-boundary interference",
        "estimated_boundary_distance_m": 2.1
      },
      "severity": "significant",
      "glm_addressable": false,
      "suggested_resolution": "placement_adjustment"
    }
  ],
  
  "theoretical_room_modes": [
    {
      "frequency_hz": 33.0,
      "mode_type": "axial",
      "dimension": "length",
      "order": 1,
      "detected_in_measurement": false
    },
    {
      "frequency_hz": 45.1,
      "mode_type": "axial", 
      "dimension": "width",
      "order": 1,
      "detected_in_measurement": false
    },
    {
      "frequency_hz": 65.9,
      "mode_type": "axial",
      "dimension": "length", 
      "order": 2,
      "detected_in_measurement": true,
      "matched_peak_hz": 66
    },
    {
      "frequency_hz": 66.0,
      "mode_type": "axial",
      "dimension": "height",
      "order": 1,
      "detected_in_measurement": true,
      "matched_peak_hz": 66,
      "note": "Overlaps with length mode - problematic clustering"
    }
  ],
  
  "mode_distribution_assessment": {
    "schroeder_frequency_hz": 185,
    "mode_spacing_quality": "poor",
    "problematic_clusters": [
      {
        "center_frequency_hz": 66,
        "bandwidth_hz": 4,
        "modes_in_cluster": 2,
        "dimensions_involved": ["length", "height"],
        "expected_behavior": "Strong peak with extended decay",
        "severity": "significant"
      }
    ],
    "mode_gaps": [
      {
        "frequency_range_hz": [45, 66],
        "gap_size_hz": 21,
        "assessment": "Large gap may cause uneven bass response"
      }
    ]
  },
  
  "summary": {
    "total_peaks_detected": 2,
    "total_nulls_detected": 1,
    "modes_correlated": 2,
    "primary_issues": [
      "Strong modal buildup at 66 Hz (length + height mode overlap)",
      "Deep SBIR null at 82 Hz"
    ],
    "glm_addressable_issues": 2,
    "placement_sensitive_issues": 1,
    "recommended_priority": [
      {
        "priority": 1,
        "issue": "82 Hz null",
        "action": "Consider speaker or listener repositioning",
        "reasoning": "Cannot be addressed by EQ"
      },
      {
        "priority": 2,
        "issue": "66 Hz mode cluster",
        "action": "GLM will reduce peak; consider bass trapping for decay",
        "reasoning": "Peak addressable, but decay may persist"
      }
    ]
  }
}
```

## Analysis Algorithms

### Peak Detection

```python
def detect_peaks(frequencies: list, spl: list,
                 threshold_db: float = 5.0,
                 window_octaves: float = 0.5) -> list:
    """
    Detect peaks in frequency response.
    
    A peak is a local maximum exceeding threshold above local average.
    """
    peaks = []
    
    for i in range(1, len(frequencies) - 1):
        freq = frequencies[i]
        level = spl[i]
        
        # Check if local maximum
        if spl[i-1] >= level or spl[i+1] >= level:
            continue
        
        # Calculate local average (within window)
        local_avg = calculate_local_average(
            frequencies, spl, freq, window_octaves
        )
        
        deviation = level - local_avg
        
        if deviation >= threshold_db:
            q = estimate_q_factor(frequencies, spl, i)
            peaks.append({
                'frequency_hz': freq,
                'level_db': round(level, 1),
                'deviation_db': round(deviation, 1),
                'q_factor': round(q, 1) if q else None
            })
    
    return peaks


def calculate_local_average(freq: list, spl: list, 
                            center_freq: float, 
                            window_octaves: float) -> float:
    """Calculate average SPL within octave window around center frequency."""
    low_freq = center_freq / (2 ** (window_octaves / 2))
    high_freq = center_freq * (2 ** (window_octaves / 2))
    
    values = [s for f, s in zip(freq, spl) if low_freq <= f <= high_freq]
    return sum(values) / len(values) if values else 0
```

### Null Detection

```python
def detect_nulls(frequencies: list, spl: list,
                 threshold_db: float = -6.0,
                 window_octaves: float = 0.5) -> list:
    """
    Detect nulls (dips) in frequency response.
    
    A null is a local minimum falling below threshold from local average.
    """
    nulls = []
    
    for i in range(1, len(frequencies) - 1):
        freq = frequencies[i]
        level = spl[i]
        
        # Check if local minimum
        if spl[i-1] <= level or spl[i+1] <= level:
            continue
        
        # Calculate local average
        local_avg = calculate_local_average(
            frequencies, spl, freq, window_octaves
        )
        
        deviation = level - local_avg  # Will be negative for nulls
        
        if deviation <= threshold_db:
            q = estimate_q_factor_null(frequencies, spl, i)
            nulls.append({
                'frequency_hz': freq,
                'level_db': round(level, 1),
                'depth_db': round(deviation, 1),
                'q_factor': round(q, 1) if q else None
            })
    
    return nulls
```

### Theoretical Mode Calculation

```python
def calculate_axial_modes(length_m: float, width_m: float, 
                          height_m: float, max_freq: float = 300) -> list:
    """Calculate theoretical axial room modes."""
    SPEED_OF_SOUND = 343.0  # m/s at 20°C
    
    modes = []
    
    dimensions = [
        (length_m, 'length'),
        (width_m, 'width'),
        (height_m, 'height')
    ]
    
    for dim_value, dim_name in dimensions:
        order = 1
        while True:
            freq = (SPEED_OF_SOUND / 2) * (order / dim_value)
            if freq > max_freq:
                break
            
            modes.append({
                'frequency_hz': round(freq, 1),
                'mode_type': 'axial',
                'dimension': dim_name,
                'order': order
            })
            order += 1
    
    return sorted(modes, key=lambda m: m['frequency_hz'])
```

### Mode Correlation

```python
def correlate_peaks_with_modes(peaks: list, modes: list,
                                tolerance_percent: float = 5.0) -> list:
    """Match detected peaks with theoretical room modes."""
    
    for peak in peaks:
        peak_freq = peak['frequency_hz']
        best_match = None
        best_error = float('inf')
        
        for mode in modes:
            mode_freq = mode['frequency_hz']
            error_pct = abs(peak_freq - mode_freq) / mode_freq * 100
            
            if error_pct <= tolerance_percent and error_pct < best_error:
                best_match = mode
                best_error = error_pct
        
        if best_match:
            peak['mode_correlation'] = {
                'theoretical_mode_hz': best_match['frequency_hz'],
                'mode_type': best_match['mode_type'],
                'dimension': best_match['dimension'],
                'order': best_match['order'],
                'match_error_percent': round(best_error, 2)
            }
            peak['classification'] = {
                'type': 'room_mode',
                'confidence': 'high' if best_error < 2.0 else 'medium',
                'reasoning': f"Matches {best_match['dimension']} {best_match['mode_type']} mode (order {best_match['order']})"
            }
        else:
            peak['classification'] = {
                'type': 'unknown',
                'confidence': 'low',
                'reasoning': 'No matching theoretical mode found'
            }
    
    return peaks
```

### SBIR (Speaker-Boundary Interference Response) Detection

```python
def classify_null_as_sbir(null: dict, 
                          speaker_distances: dict = None) -> dict:
    """
    Classify if a null is likely SBIR (speaker-boundary interference).
    
    SBIR occurs at: f = c / (4 × d)
    where d is distance from speaker to boundary.
    """
    SPEED_OF_SOUND = 343.0
    freq = null['frequency_hz']
    
    # Calculate what boundary distance would cause this null
    estimated_distance = SPEED_OF_SOUND / (4 * freq)
    
    # SBIR characteristics:
    # - Deep, narrow nulls (high Q)
    # - Typically 50-150 Hz for typical room setups
    # - Quarter-wave cancellation pattern
    
    is_likely_sbir = (
        null['q_factor'] and null['q_factor'] > 5 and
        null['depth_db'] < -8 and
        50 <= freq <= 200 and
        0.4 <= estimated_distance <= 3.0  # Reasonable room distances
    )
    
    if is_likely_sbir:
        return {
            'type': 'sbir',
            'confidence': 'medium',
            'reasoning': 'Deep narrow null consistent with speaker-boundary interference',
            'estimated_boundary_distance_m': round(estimated_distance, 2)
        }
    
    return {
        'type': 'cancellation',
        'confidence': 'low',
        'reasoning': 'Null may be caused by various interference patterns'
    }
```

## Classification Guidelines

### Peak Classifications

| Q Factor | Depth | Classification | Confidence |
|----------|-------|----------------|------------|
| Q > 8 | > +6 dB | Room mode | High |
| 5 < Q ≤ 8 | > +5 dB | Room mode or boundary | Medium |
| 3 < Q ≤ 5 | > +4 dB | Broad modal region | Medium |
| Q ≤ 3 | Any | Room gain / speaker response | Low |

### Null Classifications

| Q Factor | Depth | Classification | Typical Cause |
|----------|-------|----------------|---------------|
| Q > 8 | < -10 dB | SBIR | Speaker too close to boundary |
| Q > 8 | -6 to -10 dB | Comb filtering | Reflection interference |
| Q ≤ 8 | < -10 dB | Modal null zone | Listener at mode null |
| Any | < -15 dB | Severe cancellation | Multiple sources |

## Schroeder Frequency

The Schroeder frequency marks the transition from modal to statistical acoustic behavior:

```python
def calculate_schroeder_frequency(rt60_seconds: float, 
                                   volume_m3: float) -> float:
    """
    Calculate Schroeder frequency.
    
    f_s = 2000 × √(RT60 / V)
    
    Below this frequency, room modes dominate.
    Above this frequency, statistical reverberant field dominates.
    """
    return 2000 * (rt60_seconds / volume_m3) ** 0.5
```

Typical values for small rooms: 150-300 Hz.

## External References

- Room mode calculation: https://www.roomeqwizard.com/help/help_en-GB/html/modalsim.html
- Acoustic theory: F. Alton Everest, "Master Handbook of Acoustics"
- SBIR: https://www.soundonsound.com/techniques/studio-sos-guide-monitoring-bass
