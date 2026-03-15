# Analysis Rules

This document defines the deterministic analysis algorithms used by the MCP server. All rules are explicit, reproducible, and do not involve machine learning.

## Core Principles

1. **Deterministic**: Same input always produces same output
2. **Explainable**: Every conclusion references specific data points
3. **Conservative**: Prefer false negatives over false positives
4. **Uncertain by default**: Mark confidence levels explicitly

---

## 1. Peak Detection

### Definition

A **peak** is a local maximum in the frequency response that exceeds a threshold above the local average.

### Algorithm

```python
def detect_peaks(frequencies: list, spl: list, 
                 threshold_db: float = 5.0,
                 window_octaves: float = 0.5) -> list:
    """
    Detect peaks in frequency response.
    
    Args:
        frequencies: Frequency values in Hz
        spl: SPL values in dB
        threshold_db: Minimum dB above local average to qualify as peak
        window_octaves: Window size for local average calculation
    
    Returns:
        List of Peak objects
    """
    peaks = []
    
    for i, (freq, level) in enumerate(zip(frequencies, spl)):
        # Calculate local average (within window_octaves)
        local_avg = calculate_local_average(
            frequencies, spl, freq, window_octaves
        )
        
        # Check if this point is a local maximum
        is_local_max = is_local_maximum(spl, i)
        
        # Check if exceeds threshold
        deviation = level - local_avg
        
        if is_local_max and deviation >= threshold_db:
            peaks.append(Peak(
                frequency_hz=freq,
                level_db=level,
                deviation_db=deviation,
                q_factor=estimate_q_factor(frequencies, spl, i)
            ))
    
    return peaks
```

### Q Factor Estimation

```python
def estimate_q_factor(frequencies: list, spl: list, peak_index: int) -> float:
    """
    Estimate Q factor using -3dB bandwidth method.
    
    Q = f_center / bandwidth
    bandwidth = f_upper - f_lower (at -3dB from peak)
    """
    peak_level = spl[peak_index]
    peak_freq = frequencies[peak_index]
    target_level = peak_level - 3.0
    
    # Find -3dB points on either side
    f_lower = find_crossing_below(frequencies, spl, peak_index, target_level)
    f_upper = find_crossing_above(frequencies, spl, peak_index, target_level)
    
    if f_lower is None or f_upper is None:
        return None  # Cannot determine Q
    
    bandwidth = f_upper - f_lower
    return peak_freq / bandwidth
```

### Peak Classification

| Q Factor | Classification | Likely Cause |
|----------|---------------|--------------|
| Q > 10 | Very narrow | Room mode, resonance |
| 5 < Q ≤ 10 | Narrow | Room mode, boundary effect |
| 2 < Q ≤ 5 | Medium | Boundary reinforcement |
| Q ≤ 2 | Broad | Speaker response, room gain |

---

## 2. Null Detection

### Definition

A **null** is a local minimum in the frequency response that falls below a threshold from the local average.

### Algorithm

```python
def detect_nulls(frequencies: list, spl: list,
                 threshold_db: float = -6.0,
                 window_octaves: float = 0.5) -> list:
    """
    Detect nulls (dips) in frequency response.
    
    Args:
        frequencies: Frequency values in Hz
        spl: SPL values in dB
        threshold_db: Minimum dB below local average (negative value)
        window_octaves: Window size for local average calculation
    
    Returns:
        List of Null objects
    """
    nulls = []
    
    for i, (freq, level) in enumerate(zip(frequencies, spl)):
        local_avg = calculate_local_average(
            frequencies, spl, freq, window_octaves
        )
        
        is_local_min = is_local_minimum(spl, i)
        deviation = level - local_avg
        
        if is_local_min and deviation <= threshold_db:
            nulls.append(Null(
                frequency_hz=freq,
                level_db=level,
                deviation_db=deviation,
                q_factor=estimate_q_factor_null(frequencies, spl, i)
            ))
    
    return nulls
```

### Null Classification

| Depth | Q Factor | Classification | Likely Cause |
|-------|----------|---------------|--------------|
| > -10 dB | High Q | Sharp null | SBIR, comb filtering |
| > -10 dB | Low Q | Broad dip | Room mode null zone |
| ≤ -10 dB | Any | Deep null | Severe cancellation |

---

## 3. Room Mode Detection

### Definition

A **room mode** is a standing wave pattern at frequencies determined by room dimensions.

### Axial Mode Formula

```python
def calculate_axial_modes(length_m: float, width_m: float, height_m: float,
                          max_freq_hz: float = 300) -> list:
    """
    Calculate theoretical axial room modes.
    
    f = (c / 2) * (n / dimension)
    where c = 343 m/s (speed of sound), n = 1, 2, 3, ...
    """
    c = 343.0  # Speed of sound in m/s
    modes = []
    
    for dimension, name in [(length_m, 'length'), 
                            (width_m, 'width'), 
                            (height_m, 'height')]:
        n = 1
        while True:
            freq = (c / 2) * (n / dimension)
            if freq > max_freq_hz:
                break
            modes.append(RoomMode(
                frequency_hz=freq,
                type='axial',
                dimension=name,
                order=n
            ))
            n += 1
    
    return sorted(modes, key=lambda m: m.frequency_hz)
```

### Mode Correlation

```python
def correlate_peaks_with_modes(peaks: list, theoretical_modes: list,
                                tolerance_percent: float = 5.0) -> list:
    """
    Match detected peaks with theoretical room modes.
    
    Returns peaks annotated with mode information.
    """
    annotated = []
    
    for peak in peaks:
        best_match = None
        best_diff = float('inf')
        
        for mode in theoretical_modes:
            diff_percent = abs(peak.frequency_hz - mode.frequency_hz) / mode.frequency_hz * 100
            
            if diff_percent <= tolerance_percent and diff_percent < best_diff:
                best_match = mode
                best_diff = diff_percent
        
        annotated.append(AnnotatedPeak(
            peak=peak,
            matched_mode=best_match,
            confidence='high' if best_match and best_diff < 2.0 else 
                       'medium' if best_match else 'low'
        ))
    
    return annotated
```

---

## 4. Decay Time Analysis

### Definition

**Decay time** measures how long sound takes to decay at specific frequencies, indicating resonance severity.

### T60 Estimation from Waterfall

```python
def estimate_decay_time(waterfall: WaterfallData, 
                        frequency_hz: float,
                        decay_range_db: float = 60.0) -> float:
    """
    Estimate T60 (time for 60dB decay) at a specific frequency.
    
    Uses linear regression on decay curve.
    """
    # Extract decay curve at target frequency
    freq_index = find_nearest_index(waterfall.frequencies_hz, frequency_hz)
    
    time_ms = waterfall.time_slices_ms
    levels = [slice[freq_index] for slice in waterfall.levels_db]
    
    # Find initial level (t=0)
    initial_level = levels[0]
    
    # Fit linear regression to decay
    # Only use points above noise floor
    noise_floor = initial_level - decay_range_db
    valid_points = [(t, l) for t, l in zip(time_ms, levels) if l > noise_floor]
    
    if len(valid_points) < 3:
        return None  # Insufficient data
    
    slope, intercept = linear_regression(valid_points)
    
    # Calculate time for 60dB decay
    # slope is in dB/ms
    if slope >= 0:
        return None  # Not decaying
    
    t60_ms = -60.0 / slope
    return t60_ms / 1000.0  # Return in seconds
```

### Decay Classification

| T60 (seconds) | Frequency Range | Classification |
|---------------|-----------------|----------------|
| < 0.2 | Bass (< 200 Hz) | Good control |
| 0.2 - 0.4 | Bass | Acceptable |
| 0.4 - 0.6 | Bass | Problematic |
| > 0.6 | Bass | Severe ringing |
| < 0.3 | Midrange | Good |
| > 0.5 | Midrange | Problematic |

---

## 5. Reflection Detection (ETC Analysis)

### Definition

**Early reflections** are sound arrivals within 20ms of the direct sound that can cause comb filtering.

### Algorithm

```python
def detect_reflections(etc_time_ms: list, etc_level_db: list,
                       direct_sound_threshold_db: float = -20.0,
                       reflection_threshold_db: float = -10.0) -> list:
    """
    Detect early reflections from Energy Time Curve.
    
    Args:
        etc_time_ms: Time values in milliseconds
        etc_level_db: Level values in dB (normalized to direct sound = 0dB)
        direct_sound_threshold_db: Level above which direct sound is detected
        reflection_threshold_db: Minimum level relative to direct sound
    
    Returns:
        List of Reflection objects
    """
    # Find direct sound (first major peak)
    direct_idx = None
    for i, level in enumerate(etc_level_db):
        if level >= direct_sound_threshold_db:
            direct_idx = i
            break
    
    if direct_idx is None:
        return []  # No direct sound found
    
    direct_time = etc_time_ms[direct_idx]
    direct_level = etc_level_db[direct_idx]
    
    reflections = []
    
    # Search for reflections (peaks after direct sound, within 50ms)
    for i in range(direct_idx + 1, len(etc_time_ms)):
        time = etc_time_ms[i]
        level = etc_level_db[i]
        
        delay_ms = time - direct_time
        
        if delay_ms > 50.0:
            break  # Beyond early reflection window
        
        relative_level = level - direct_level
        
        if is_local_maximum(etc_level_db, i) and relative_level >= reflection_threshold_db:
            reflections.append(Reflection(
                delay_ms=delay_ms,
                level_db=relative_level,
                estimated_distance_m=delay_ms * 0.343 / 2,  # Round trip
                likely_surface=estimate_surface(delay_ms)
            ))
    
    return reflections
```

### Surface Estimation

```python
def estimate_surface(delay_ms: float) -> str:
    """
    Estimate likely reflecting surface based on delay time.
    Assumes typical room dimensions and speaker/listener positions.
    """
    distance_m = delay_ms * 0.343 / 2  # Half of round trip
    
    # These are rough estimates - should be adjusted based on actual room
    if distance_m < 0.5:
        return "console/desk"
    elif distance_m < 1.0:
        return "floor_or_ceiling"
    elif distance_m < 1.5:
        return "side_wall"
    elif distance_m < 2.5:
        return "front_or_rear_wall"
    else:
        return "far_boundary"
```

---

## 6. Comparison Analysis

### Frequency Band Comparison

```python
def compare_frequency_bands(measurement_a: Measurement,
                            measurement_b: Measurement) -> ComparisonResult:
    """
    Compare two measurements across standard frequency bands.
    """
    bands = [
        ('sub_bass', 20, 60),
        ('bass', 60, 250),
        ('low_mid', 250, 500),
        ('mid', 500, 2000),
        ('high_mid', 2000, 6000),
        ('high', 6000, 20000)
    ]
    
    results = []
    
    for name, low, high in bands:
        avg_a = calculate_band_average(measurement_a, low, high)
        avg_b = calculate_band_average(measurement_b, low, high)
        
        var_a = calculate_band_variance(measurement_a, low, high)
        var_b = calculate_band_variance(measurement_b, low, high)
        
        delta_level = avg_b - avg_a
        delta_variance = var_b - var_a
        
        results.append(BandComparison(
            band_name=name,
            freq_low_hz=low,
            freq_high_hz=high,
            level_delta_db=delta_level,
            variance_delta_db=delta_variance,
            assessment=assess_change(delta_level, delta_variance)
        ))
    
    return ComparisonResult(bands=results)

def assess_change(level_delta: float, variance_delta: float) -> str:
    """
    Assess whether change is improvement, regression, or neutral.
    
    Lower variance is generally better (smoother response).
    Level changes depend on context.
    """
    if variance_delta < -1.0:
        return 'improved'  # Smoother response
    elif variance_delta > 1.0:
        return 'regressed'  # Rougher response
    else:
        return 'neutral'
```

---

## 7. Confidence Scoring

### Confidence Levels

| Level | Criteria |
|-------|----------|
| `high` | Clear pattern, strong evidence, reproducible |
| `medium` | Likely pattern, moderate evidence |
| `low` | Possible pattern, weak evidence, could be noise |
| `uncertain` | Insufficient data to determine |

### Confidence Factors

```python
def calculate_analysis_confidence(measurement: Measurement) -> str:
    """
    Determine overall confidence in analysis results.
    """
    factors = []
    
    # Data point density
    points_per_octave = calculate_points_per_octave(measurement)
    if points_per_octave >= 48:
        factors.append(1.0)
    elif points_per_octave >= 24:
        factors.append(0.8)
    elif points_per_octave >= 12:
        factors.append(0.6)
    else:
        factors.append(0.3)
    
    # Frequency range coverage
    if measurement.frequencies_hz[0] <= 20 and measurement.frequencies_hz[-1] >= 20000:
        factors.append(1.0)
    elif measurement.frequencies_hz[0] <= 30:
        factors.append(0.8)
    else:
        factors.append(0.5)
    
    # Data consistency (no gaps or anomalies)
    if has_data_gaps(measurement):
        factors.append(0.5)
    else:
        factors.append(1.0)
    
    avg_confidence = sum(factors) / len(factors)
    
    if avg_confidence >= 0.8:
        return 'high'
    elif avg_confidence >= 0.6:
        return 'medium'
    elif avg_confidence >= 0.4:
        return 'low'
    else:
        return 'uncertain'
```
