# Tool: rew.analyze_impulse

Analyzes impulse response and Energy Time Curve (ETC) data to detect early reflections.

## MCP Tool Definition

> **Reference**: MCP Tools Specification (Protocol Version 2025-06-18)
> https://modelcontextprotocol.io/specification/2025-06-18/server/tools

```json
{
  "name": "rew.analyze_impulse",
  "title": "Analyze Impulse Response",
  "description": "Analyze impulse response data to detect early reflections, estimate reflection paths, and assess their impact on sound quality.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "measurement_id": {
        "type": "string",
        "minLength": 1,
        "description": "ID of measurement with impulse response data"
      },
      "analysis_options": {
        "type": "object",
        "properties": {
          "max_reflection_time_ms": {
            "type": "number",
            "default": 50,
            "minimum": 10,
            "maximum": 200,
            "description": "Maximum time window for early reflection analysis"
          },
          "reflection_threshold_db": {
            "type": "number",
            "default": -15,
            "minimum": -40,
            "maximum": -3,
            "description": "Minimum level relative to direct sound to flag as significant reflection"
          }
        }
      }
    },
    "required": ["measurement_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "measurement_id": { "type": "string" },
      "analysis_type": { "type": "string", "const": "impulse_response_analysis" },
      "analysis_confidence": { "type": "string", "enum": ["high", "medium", "low", "uncertain"] },
      "direct_sound": {
        "type": "object",
        "properties": {
          "arrival_time_ms": { "type": "number" },
          "level_db": { "type": "number" },
          "peak_sample_index": { "type": "integer" }
        },
        "required": ["arrival_time_ms", "level_db"]
      },
      "early_reflections": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "delay_ms": { "type": "number" },
            "level_relative_db": { "type": "number" },
            "level_absolute_db": { "type": "number" },
            "estimated_path_length_m": { "type": "number" },
            "likely_source": {
              "type": "object",
              "properties": {
                "surface": { "type": "string" },
                "confidence": { "type": "string", "enum": ["high", "medium", "low"] },
                "reasoning": { "type": "string" }
              }
            },
            "severity": { "type": "string", "enum": ["severe", "significant", "moderate", "minor", "negligible"] },
            "comb_filter_analysis": {
              "type": "object",
              "properties": {
                "affected_frequencies_hz": { "type": "array", "items": { "type": "number" } },
                "first_null_hz": { "type": "number" },
                "pattern": { "type": "string" }
              }
            },
            "suggested_treatment": {
              "type": "object",
              "properties": {
                "action": { "type": "string" },
                "expected_reduction_db": { "type": "string" },
                "confidence": { "type": "string", "enum": ["high", "medium", "low"] }
              }
            }
          },
          "required": ["delay_ms", "level_relative_db", "severity"]
        }
      },
      "initial_time_delay_gap": {
        "type": "object",
        "properties": {
          "itd_ms": { "type": "number" },
          "assessment": { "type": "string", "enum": ["excellent", "good", "acceptable", "short", "poor"] },
          "note": { "type": "string" },
          "ideal_minimum_ms": { "type": "number" },
          "impact": { "type": "string" }
        },
        "required": ["itd_ms", "assessment"]
      },
      "reflection_pattern_analysis": {
        "type": "object",
        "properties": {
          "total_early_reflections": { "type": "integer" },
          "significant_reflections": { "type": "integer" },
          "average_level_db": { "type": "number" },
          "reflection_density": { "type": "string", "enum": ["sparse", "moderate", "dense"] },
          "symmetry_assessment": { "type": ["string", "null"] }
        }
      },
      "comb_filtering_risk": {
        "type": "object",
        "properties": {
          "level": { "type": "string", "enum": ["severe", "moderate", "low", "minimal"] },
          "primary_concern": {
            "type": "object",
            "properties": {
              "source": { "type": "string" },
              "first_null_frequency_hz": { "type": "number" },
              "affected_range": { "type": "string" }
            }
          },
          "expected_audible_effect": { "type": "string" }
        },
        "required": ["level"]
      },
      "clarity_metrics": {
        "type": "object",
        "properties": {
          "c50_db": { "type": "number" },
          "c80_db": { "type": "number" },
          "d50_percent": { "type": "number" },
          "assessment": { "type": "string" }
        }
      },
      "summary": {
        "type": "object",
        "properties": {
          "primary_issues": { "type": "array", "items": { "type": "string" } },
          "reflection_quality": { "type": "string", "enum": ["excellent", "good", "acceptable", "needs_improvement", "poor"] },
          "recommended_priority": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "priority": { "type": "integer", "minimum": 1 },
                "issue": { "type": "string" },
                "action": { "type": "string" },
                "impact": { "type": "string" }
              }
            }
          }
        },
        "required": ["reflection_quality"]
      },
      "error": { "type": "string" },
      "message": { "type": "string" }
    },
    "required": ["measurement_id", "analysis_type", "analysis_confidence"]
  }
}
```

## REW Impulse Response Data

> **Reference**: REW impulse response documentation
> https://www.roomeqwizard.com/help/help_en-GB/html/impulseresponse.html

### Data Format (from REW IR text export)

```
Impulse Response data saved by REW V5.19
IR is normalised
...
48000 // Peak index
131072 // Response length
2.0833333333333333E-5 // Sample interval (seconds)
-1.0 // Start time (seconds)

<sample values, one per line>
```

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| Peak index | Sample number of direct sound arrival |
| Response length | Total samples in IR |
| Sample interval | 1 / sample_rate |
| Start time | Time offset of first sample |

## Output Specification

```json
{
  "measurement_id": "meas_L_with_ir",
  "analysis_type": "impulse_response_analysis",
  "analysis_confidence": "high",
  
  "direct_sound": {
    "arrival_time_ms": 0.0,
    "level_db": 0.0,
    "peak_sample_index": 48000
  },
  
  "early_reflections": [
    {
      "delay_ms": 2.1,
      "level_relative_db": -8.2,
      "level_absolute_db": -8.2,
      "estimated_path_length_m": 0.72,
      "likely_source": {
        "surface": "desk_or_console",
        "confidence": "medium",
        "reasoning": "Delay corresponds to ~72cm path, consistent with desk reflection"
      },
      "severity": "significant",
      "comb_filter_analysis": {
        "affected_frequencies_hz": [238, 476, 714, 952],
        "first_null_hz": 238,
        "pattern": "Harmonic series of dips at multiples of 238 Hz"
      },
      "suggested_treatment": {
        "action": "Add absorption on desk surface",
        "expected_reduction_db": "6-10 dB",
        "confidence": "high"
      }
    },
    {
      "delay_ms": 4.8,
      "level_relative_db": -12.5,
      "estimated_path_length_m": 1.64,
      "likely_source": {
        "surface": "floor_or_ceiling",
        "confidence": "medium",
        "reasoning": "Delay corresponds to ~1.6m path, typical for floor bounce"
      },
      "severity": "moderate"
    },
    {
      "delay_ms": 7.2,
      "level_relative_db": -14.8,
      "estimated_path_length_m": 2.47,
      "likely_source": {
        "surface": "side_wall",
        "confidence": "low",
        "reasoning": "Path length consistent with first side wall reflection"
      },
      "severity": "minor"
    }
  ],
  
  "initial_time_delay_gap": {
    "itd_ms": 2.1,
    "assessment": "short",
    "note": "Reflection arrives only 2.1ms after direct sound",
    "ideal_minimum_ms": 5.0,
    "impact": "Reduced clarity; direct sound not clearly separated from reflections"
  },
  
  "reflection_pattern_analysis": {
    "total_early_reflections": 3,
    "significant_reflections": 1,
    "average_level_db": -11.8,
    "reflection_density": "moderate",
    "symmetry_assessment": null
  },
  
  "comb_filtering_risk": {
    "level": "moderate",
    "primary_concern": {
      "source": "Desk reflection at 2.1ms",
      "first_null_frequency_hz": 238,
      "affected_range": "Low-mid frequencies"
    },
    "expected_audible_effect": "Coloration in vocal/midrange frequencies"
  },
  
  "clarity_metrics": {
    "c50_db": 12.5,
    "c80_db": 18.2,
    "d50_percent": 94.7,
    "assessment": "Good clarity for music reproduction"
  },
  
  "summary": {
    "primary_issues": [
      "Strong desk reflection at 2.1ms causing comb filtering",
      "Short initial time delay gap (2.1ms)"
    ],
    "reflection_quality": "needs_improvement",
    "recommended_priority": [
      {
        "priority": 1,
        "issue": "Desk reflection",
        "action": "Add absorption pad on desk between speakers and listening position",
        "impact": "High - will reduce primary comb filtering"
      },
      {
        "priority": 2,
        "issue": "Floor bounce",
        "action": "Consider absorption under listening position if desk treatment insufficient",
        "impact": "Medium"
      }
    ]
  }
}
```

## Analysis Algorithms

### Energy Time Curve (ETC) Generation

```python
def generate_etc(ir_samples: list, sample_rate: int) -> tuple:
    """
    Generate Energy Time Curve from impulse response.
    
    ETC = 20 * log10(|Hilbert(IR)|)
    """
    import numpy as np
    from scipy.signal import hilbert
    
    # Get analytic signal via Hilbert transform
    analytic = hilbert(ir_samples)
    envelope = np.abs(analytic)
    
    # Convert to dB, avoid log(0)
    etc_db = 20 * np.log10(envelope + 1e-10)
    
    # Generate time axis
    time_ms = np.arange(len(ir_samples)) / sample_rate * 1000
    
    return time_ms, etc_db
```

### Direct Sound Detection

```python
def find_direct_sound(etc_db: list, time_ms: list,
                      threshold_db: float = -20) -> dict:
    """
    Find the direct sound arrival in the ETC.
    
    Direct sound is the first significant peak.
    """
    # Find first sample above threshold
    for i, level in enumerate(etc_db):
        if level >= threshold_db:
            # Find actual peak in this region
            peak_idx = i
            while peak_idx < len(etc_db) - 1 and etc_db[peak_idx + 1] > etc_db[peak_idx]:
                peak_idx += 1
            
            return {
                'index': peak_idx,
                'time_ms': time_ms[peak_idx],
                'level_db': etc_db[peak_idx]
            }
    
    return None
```

### Reflection Detection

```python
def detect_reflections(etc_db: list, time_ms: list,
                       direct_sound: dict,
                       max_time_ms: float = 50,
                       threshold_db: float = -15) -> list:
    """
    Detect early reflections after direct sound.
    
    Reflections are local maxima within the time window
    that exceed the threshold relative to direct sound.
    """
    reflections = []
    direct_time = direct_sound['time_ms']
    direct_level = direct_sound['level_db']
    
    # Search window: direct sound + 1ms to max_time_ms
    for i in range(len(time_ms)):
        time = time_ms[i]
        delay = time - direct_time
        
        if delay < 1.0:  # Skip direct sound region
            continue
        if delay > max_time_ms:
            break
        
        level = etc_db[i]
        relative_level = level - direct_level
        
        # Check if local maximum
        if i > 0 and i < len(etc_db) - 1:
            if etc_db[i-1] < level > etc_db[i+1]:
                if relative_level >= threshold_db:
                    reflections.append({
                        'delay_ms': round(delay, 1),
                        'level_relative_db': round(relative_level, 1),
                        'index': i
                    })
    
    return reflections
```

### Path Length Estimation

```python
SPEED_OF_SOUND = 343.0  # m/s at 20°C

def estimate_path_length(delay_ms: float) -> float:
    """
    Estimate reflection path length from delay time.
    
    path = (delay / 1000) * speed_of_sound
    
    Note: This is the ADDITIONAL path length beyond the direct path.
    For a single reflection, total path = direct_path + extra_path.
    """
    return (delay_ms / 1000) * SPEED_OF_SOUND
```

### Surface Estimation

```python
def estimate_reflecting_surface(delay_ms: float,
                                 path_length_m: float) -> dict:
    """
    Estimate likely reflecting surface based on delay time
    and typical room/setup dimensions.
    
    These are heuristics based on common studio setups.
    """
    
    # Very short delays: nearby surfaces
    if delay_ms < 3.0:
        if path_length_m < 0.8:
            return {
                'surface': 'desk_or_console',
                'confidence': 'medium',
                'reasoning': f'Short delay ({delay_ms}ms) with {path_length_m:.1f}m path suggests desk/console reflection'
            }
    
    # Short delays: floor, ceiling, nearby walls
    if delay_ms < 6.0:
        if path_length_m < 2.0:
            return {
                'surface': 'floor_or_ceiling',
                'confidence': 'medium',
                'reasoning': f'Delay of {delay_ms}ms with {path_length_m:.1f}m path consistent with floor/ceiling bounce'
            }
    
    # Medium delays: side walls
    if delay_ms < 10.0:
        return {
            'surface': 'side_wall',
            'confidence': 'low',
            'reasoning': f'Path length of {path_length_m:.1f}m suggests side wall reflection'
        }
    
    # Longer delays: front/rear walls
    if delay_ms < 20.0:
        return {
            'surface': 'front_or_rear_wall',
            'confidence': 'low',
            'reasoning': f'Longer path ({path_length_m:.1f}m) suggests front or rear wall'
        }
    
    return {
        'surface': 'far_boundary',
        'confidence': 'low',
        'reasoning': 'Long delay suggests distant boundary'
    }
```

### Comb Filter Analysis

```python
def analyze_comb_filtering(delay_ms: float, 
                            level_db: float) -> dict:
    """
    Analyze comb filtering caused by a reflection.
    
    Comb filter null frequencies: f_null = (2n+1) / (2 * delay)
    Comb filter peak frequencies: f_peak = n / delay
    
    where n = 0, 1, 2, ...
    """
    delay_seconds = delay_ms / 1000
    
    # First null frequency
    first_null_hz = 1 / (2 * delay_seconds)
    
    # Calculate first several nulls and peaks
    nulls = []
    for n in range(10):
        null_freq = (2*n + 1) / (2 * delay_seconds)
        if null_freq > 10000:
            break
        nulls.append(round(null_freq, 0))
    
    # Severity depends on reflection level
    if level_db > -6:
        severity = 'severe'
    elif level_db > -10:
        severity = 'significant'
    elif level_db > -15:
        severity = 'moderate'
    else:
        severity = 'minor'
    
    return {
        'first_null_hz': round(first_null_hz, 0),
        'affected_frequencies_hz': nulls[:5],  # First 5 nulls
        'pattern': f'Harmonic series of dips starting at {round(first_null_hz)}Hz',
        'severity': severity
    }
```

### Clarity Metrics

```python
def calculate_clarity_metrics(ir_samples: list, 
                               sample_rate: int,
                               direct_sound_index: int) -> dict:
    """
    Calculate C50, C80, and D50 clarity metrics.
    
    C50 = 10 * log10(E_0-50ms / E_50ms-inf) [dB]
    C80 = 10 * log10(E_0-80ms / E_80ms-inf) [dB]
    D50 = E_0-50ms / E_total * 100 [%]
    
    Higher values indicate better clarity.
    """
    import numpy as np
    
    ir = np.array(ir_samples)
    ir_squared = ir ** 2
    
    # Sample indices for time boundaries
    samples_50ms = int(0.050 * sample_rate)
    samples_80ms = int(0.080 * sample_rate)
    
    # Align to direct sound
    start = direct_sound_index
    
    # Energy calculations
    e_0_50 = np.sum(ir_squared[start:start + samples_50ms])
    e_0_80 = np.sum(ir_squared[start:start + samples_80ms])
    e_50_inf = np.sum(ir_squared[start + samples_50ms:])
    e_80_inf = np.sum(ir_squared[start + samples_80ms:])
    e_total = np.sum(ir_squared[start:])
    
    # Calculate metrics
    c50 = 10 * np.log10(e_0_50 / e_50_inf) if e_50_inf > 0 else float('inf')
    c80 = 10 * np.log10(e_0_80 / e_80_inf) if e_80_inf > 0 else float('inf')
    d50 = (e_0_50 / e_total) * 100 if e_total > 0 else 0
    
    return {
        'c50_db': round(c50, 1),
        'c80_db': round(c80, 1),
        'd50_percent': round(d50, 1)
    }
```

## Reflection Severity Classification

| Level (rel. to direct) | Classification | Impact |
|------------------------|----------------|--------|
| > -6 dB | Severe | Strong comb filtering, compromised imaging |
| -6 to -10 dB | Significant | Noticeable coloration |
| -10 to -15 dB | Moderate | Subtle coloration |
| -15 to -20 dB | Minor | Minimal audible impact |
| < -20 dB | Negligible | Below perception threshold |

## Initial Time Delay Gap (ITD Gap)

| ITD Gap | Assessment | Note |
|---------|------------|------|
| > 15 ms | Excellent | Clear separation of direct sound |
| 10-15 ms | Good | Adequate for critical listening |
| 5-10 ms | Acceptable | Some compromise |
| < 5 ms | Poor | Direct sound not clearly distinguished |

## External References

- REW Impulse Response: https://www.roomeqwizard.com/help/help_en-GB/html/impulseresponse.html
- REW IR graph: https://www.roomeqwizard.com/help/help_en-GB/html/graph_impulse.html
- ETC analysis: https://www.roomeqwizard.com/help/help_en-GB/html/graph_filtedir.html
- Clarity metrics (ISO 3382): International standard for room acoustics
