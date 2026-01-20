# Tool: rew.ingest_measurement

Parses and stores REW measurement data for subsequent analysis.

## MCP Tool Definition

> **Reference**: MCP Tools Specification at https://modelcontextprotocol.io/specification/2025-06-18/server/tools

```json
{
  "name": "rew.ingest_measurement",
  "description": "Parse and store a REW measurement export for analysis. Accepts frequency response or impulse response data in REW text export format.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_contents": {
        "type": "string",
        "description": "The complete contents of a REW export file (text format)"
      },
      "metadata": {
        "type": "object",
        "properties": {
          "speaker_id": {
            "type": "string",
            "enum": ["L", "R", "C", "Sub", "Combined", "LFE", "SL", "SR", "RL", "RR"],
            "description": "Speaker channel identifier"
          },
          "condition": {
            "type": "string",
            "description": "Measurement condition label (e.g., 'pre_glm', 'post_glm', 'placement_A')"
          },
          "mic_position_id": {
            "type": "string",
            "description": "Identifier for the microphone/listening position"
          },
          "notes": {
            "type": "string",
            "description": "Free-form notes about this measurement"
          }
        },
        "required": ["speaker_id", "condition"]
      }
    },
    "required": ["file_contents", "metadata"]
  }
}
```

## Input Specification

### file_contents

The complete text content of a REW export file. Supported formats:

1. **Frequency Response Text** (File → Export → Export measurement as text)
2. **Impulse Response Text** (File → Export → Export impulse response as text)

See [file-formats.md](../file-formats.md) for detailed format specifications.

### metadata

User-provided context for the measurement:

| Field | Required | Description | Examples |
|-------|----------|-------------|----------|
| `speaker_id` | Yes | Channel identifier | `"L"`, `"R"`, `"Sub"`, `"Combined"` |
| `condition` | Yes | Measurement context | `"pre_glm"`, `"post_glm"`, `"placement_test_1"` |
| `mic_position_id` | No | Listening position ID | `"main_listening_position"`, `"pos_A"` |
| `notes` | No | Free-form notes | `"Speaker 50cm from rear wall"` |

## Output Specification

### Success Response

```json
{
  "status": "success",
  "measurement_id": "meas_20240120_abc123",
  "summary": {
    "data_type": "frequency_response",
    "frequency_range_hz": [20.0, 20000.0],
    "data_points": 512,
    "points_per_octave": 48,
    "has_phase_data": true,
    "has_impulse_data": false,
    "overall_level_db": 75.3
  },
  "quick_stats": {
    "bass_avg_db": 78.2,
    "midrange_avg_db": 75.1,
    "treble_avg_db": 72.8,
    "variance_20_200hz_db": 8.4,
    "variance_200_2000hz_db": 3.2,
    "variance_2000_20000hz_db": 2.1
  },
  "data_quality": {
    "confidence": "high",
    "warnings": []
  },
  "parsed_file_metadata": {
    "rew_version": "5.31",
    "measurement_name": "Left Speaker Pre-GLM",
    "export_date": "2024-01-20T14:30:00Z",
    "source_description": "Microphone (Umik-1), Right channel"
  }
}
```

### Error Response

```json
{
  "status": "error",
  "error_type": "parse_error",
  "message": "Could not parse file: unrecognized format",
  "details": {
    "expected_formats": ["rew_frequency_response_text", "rew_impulse_response_text"],
    "detected_format": null,
    "line_number": null
  },
  "suggestion": "Ensure file was exported from REW using File → Export → Export measurement as text"
}
```

## Processing Logic

### Step 1: Format Detection

```python
def detect_format(content: str) -> str:
    """Detect REW export format from file content."""
    first_lines = content[:2000]
    
    if 'Impulse Response data saved by REW' in first_lines:
        return 'impulse_response_text'
    
    if 'Freq(Hz)' in first_lines or '* Freq' in first_lines:
        return 'frequency_response_text'
    
    # Check for numeric data pattern (freq SPL phase)
    lines = first_lines.split('\n')
    for line in lines:
        if line.startswith('*'):
            continue
        parts = line.split()
        if len(parts) >= 2:
            try:
                float(parts[0])
                float(parts[1])
                return 'frequency_response_text'
            except ValueError:
                continue
    
    return 'unknown'
```

### Step 2: Parse Content

See [file-formats.md](../file-formats.md) for parsing implementations.

### Step 3: Validate Data

```python
def validate_measurement(data: ParsedMeasurement) -> ValidationResult:
    """Validate parsed measurement data."""
    warnings = []
    errors = []
    
    # Check frequency range
    if data.frequencies_hz[0] > 30:
        warnings.append({
            "type": "limited_low_frequency",
            "message": f"Data starts at {data.frequencies_hz[0]} Hz, bass analysis may be limited"
        })
    
    # Check data point density
    ppo = calculate_points_per_octave(data.frequencies_hz)
    if ppo < 12:
        warnings.append({
            "type": "low_resolution",
            "message": f"Only {ppo} points per octave, detailed peak analysis may be unreliable"
        })
    
    # Check for data gaps
    if has_frequency_gaps(data.frequencies_hz):
        errors.append({
            "type": "data_gaps",
            "message": "Non-monotonic or missing frequency data detected"
        })
    
    # Check SPL range
    if max(data.spl_db) - min(data.spl_db) > 60:
        warnings.append({
            "type": "extreme_range",
            "message": "SPL range exceeds 60 dB, check for measurement artifacts"
        })
    
    return ValidationResult(
        valid=len(errors) == 0,
        confidence='high' if len(warnings) == 0 else 'medium' if len(warnings) < 3 else 'low',
        warnings=warnings,
        errors=errors
    )
```

### Step 4: Calculate Quick Stats

```python
def calculate_quick_stats(freq: list, spl: list) -> dict:
    """Calculate summary statistics for the measurement."""
    
    # Define frequency bands
    bands = {
        'bass': (20, 200),
        'midrange': (200, 2000),
        'treble': (2000, 20000)
    }
    
    stats = {}
    for name, (low, high) in bands.items():
        band_data = [(f, s) for f, s in zip(freq, spl) if low <= f <= high]
        if band_data:
            levels = [s for _, s in band_data]
            stats[f'{name}_avg_db'] = sum(levels) / len(levels)
    
    # Calculate variance in key regions
    for low, high in [(20, 200), (200, 2000), (2000, 20000)]:
        band_data = [s for f, s in zip(freq, spl) if low <= f <= high]
        if len(band_data) >= 2:
            avg = sum(band_data) / len(band_data)
            variance = sum((x - avg) ** 2 for x in band_data) / len(band_data)
            stats[f'variance_{low}_{high}hz_db'] = variance ** 0.5
    
    return stats
```

### Step 5: Store Measurement

Generate unique ID and store in measurement store with:
- Parsed frequency/SPL/phase data
- User-provided metadata
- Parsed file metadata
- Timestamp
- Validation results

## Usage Examples

### Example 1: Ingest Pre-GLM Measurement

**Input**:
```json
{
  "file_contents": "* Freq(Hz) SPL(dB) Phase(degrees)\n* Measurement: Left Pre-GLM\n20.0 68.5 45.2\n...",
  "metadata": {
    "speaker_id": "L",
    "condition": "pre_glm",
    "mic_position_id": "main_lp",
    "notes": "Default speaker placement before calibration"
  }
}
```

**Output**:
```json
{
  "status": "success",
  "measurement_id": "meas_L_pre_glm_20240120",
  "summary": {
    "data_type": "frequency_response",
    "frequency_range_hz": [20.0, 20000.0],
    "data_points": 512,
    "points_per_octave": 48,
    "has_phase_data": true,
    "overall_level_db": 75.8
  },
  "data_quality": {
    "confidence": "high",
    "warnings": []
  }
}
```

### Example 2: Low-Quality Data Warning

**Output**:
```json
{
  "status": "success",
  "measurement_id": "meas_R_test_20240120",
  "summary": {
    "data_type": "frequency_response",
    "frequency_range_hz": [50.0, 15000.0],
    "data_points": 64,
    "points_per_octave": 6,
    "has_phase_data": false,
    "overall_level_db": 72.1
  },
  "data_quality": {
    "confidence": "low",
    "warnings": [
      {
        "type": "limited_low_frequency",
        "message": "Data starts at 50 Hz, bass analysis may be limited"
      },
      {
        "type": "low_resolution",
        "message": "Only 6 points per octave, detailed peak analysis may be unreliable"
      },
      {
        "type": "no_phase_data",
        "message": "Phase data not available, some analyses will be limited"
      }
    ]
  }
}
```

## Error Conditions

| Error Type | Cause | User Action |
|------------|-------|-------------|
| `parse_error` | File format not recognized | Re-export from REW as text |
| `validation_error` | Invalid metadata values | Check speaker_id and condition values |
| `insufficient_data` | Too few data points (<10) | Re-export with higher resolution |
| `corrupt_data` | Non-numeric values in data | Check file integrity |
