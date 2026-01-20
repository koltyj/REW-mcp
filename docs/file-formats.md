# REW File Formats

This document specifies the REW export formats the MCP server must support.

> **Reference**: Official REW documentation at https://www.roomeqwizard.com/help/help_en-GB/html/file.html

## Supported Formats

| Format | Priority | Description |
|--------|----------|-------------|
| Text Export (.txt) | Required | "Export measurement as text" from REW |
| Impulse Response Text | Required | "Export impulse response as text" |
| MDAT (.mdat) | Optional | REW native binary format |
| WAV | Optional | Impulse response as WAV file |

---

## 1. REW Frequency Response Text Export

### How to Export from REW

1. Select measurement in REW
2. File → Export → Export measurement as text

### Official Format (from REW docs)

The format is compatible with the .FRD format. Comment lines start with `*`, data lines begin with:
1. Frequency (Hz)
2. SPL in dB
3. Phase in degrees (0.0 if measurement does not have phase information)

### Example File Structure

```
* Freq(Hz) SPL(dB) Phase(degrees)
* Measurement: Example Room Measurement
* Dated: 20-Jan-2024 14:30:00
* Source: Microphone (Umik-1), MICROPHONE (Master Volume)
* Excitation: 256k Log Swept Sine
* Response measured over: 20.0 to 20,000.0 Hz
* Note: Pre-GLM measurement, left speaker
20.000 65.23 45.2
20.500 65.45 42.1
21.000 65.67 39.8
...
```

### REW Export Settings (from official docs)

REW provides these export options:
- **Frequency range**: Start and end frequencies
- **Resolution**: Measurement resolution or custom log-spaced resolution (PPO)
- **Smoothing**: None, or 1/1 to 1/48 octave
- **Number format**: Dot decimal delimiter (default) or computer's locale
- **Delimiter**: Space, tab, comma, or semicolon

### Parsing Rules

1. **Comment lines**: Lines starting with `*` contain metadata
   - Extract: measurement name, date, source, excitation, frequency range, notes
   
2. **Data lines**: Space/tab/comma-separated numeric values
   - Column 1: Frequency (Hz) - always present
   - Column 2: SPL (dB) - always present  
   - Column 3: Phase (degrees) - may be 0.0 if not available

3. **Number formats to handle**:
   - Scientific notation: `1.23e+02` → `123.0`
   - Locale-specific decimals: Some systems use `,` instead of `.`

### Pseudocode

```python
def parse_rew_frequency_response_text(content: str) -> Measurement:
    lines = content.strip().split('\n')
    metadata = {}
    frequencies = []
    spl_values = []
    phase_values = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith('*'):
            # Parse metadata from comment
            parse_metadata_line(line, metadata)
            continue
        
        # Data line - split by whitespace or detected delimiter
        parts = line.split()
        if len(parts) >= 2:
            try:
                freq = float(parts[0])
                spl = float(parts[1])
                phase = float(parts[2]) if len(parts) >= 3 else 0.0
                
                frequencies.append(freq)
                spl_values.append(spl)
                phase_values.append(phase)
            except ValueError:
                continue  # Skip malformed lines
    
    return Measurement(
        frequencies_hz=frequencies,
        spl_db=spl_values,
        phase_degrees=phase_values,
        metadata=metadata
    )
```

---

## 2. REW Impulse Response Text Export

### How to Export from REW

1. Select measurement in REW
2. File → Export → Export impulse response as text

### Official Format (from REW docs)

```
Impulse Response data saved by REW V5.19
IR is normalised
IR window has not been applied
IR is not the min phase version
Source: Microphone (Umik-1  Gain:  0dB  ), MICROPHONE (Master Volume), Right channel, volume: 0.550
Dated: 05-May-2014 14:12:40
Measurement: Artist 3+Q2070Si
Excitation:  256k Log Swept Sine, 1 sweep at -12.0 dB FS
Response measured over: 2.2 to 24,000.0 Hz
4.33353241533041E-4 // Peak value before normalisation
48000 // Peak index
131072 // Response length
2.0833333333333333E-5 // Sample interval (seconds)
-1.0 // Start time (seconds)

-3.1990022E-4
4.7188485E-4
-3.4590682E-4
...
```

### Header Fields

| Field | Description |
|-------|-------------|
| Peak value before normalisation | Original peak amplitude |
| Peak index | Sample index of IR peak |
| Response length | Total number of samples |
| Sample interval (seconds) | 1 / sample_rate |
| Start time (seconds) | Time offset of first sample |

### Parsing Rules

1. Parse header lines until blank line
2. Extract numeric metadata from lines with `//` comments
3. Parse sample values (one per line, scientific notation)
4. Calculate sample rate: `1 / sample_interval`

---

## 3. REW Waterfall/Spectrogram Data

### From REW API (official documentation)

REW's API returns waterfall/spectrogram data as:
- Array of frequencies (Hz)
- Array of times (ms) or periods
- 2D array of SPL values: `levels[time_index][freq_index]`

### Data Structure

```typescript
interface WaterfallData {
  frequencies_hz: number[];      // Frequency bins
  time_slices_ms: number[];      // Time values
  levels_db: number[][];         // 2D array [time][frequency]
  mode: 'fourier' | 'burst_decay';
  parameters: {
    slices: number;
    window_width_ms?: number;    // For Fourier mode
    bandwidth?: string;          // For burst decay (e.g., "1/3")
    periods?: number;            // For burst decay
  };
}
```

---

## 4. MDAT Binary Format (Optional)

### Overview

`.mdat` is REW's native binary format. From official docs:
- Save/load via File → Save measurement / Open measurement
- Contains complete measurement data including IR, FR, calibration

### Recommendation

For initial implementation, prefer text exports. MDAT parsing requires reverse engineering the binary format.

---

## 5. WAV Impulse Response Export

### How to Export from REW

1. Select measurement
2. File → Export → Export impulse response as WAV

### Official Options (from REW docs)

- **Sample format**: 16, 24, or 32-bit signed PCM, or 32-bit Float
- **Normalisation**: Optional (peak = 0 dBFS)
- **IR Window**: Optional (apply current window settings)
- **Sample rates**: Can resample to multiple rates
- **Content**: Measured IR, filtered IR (with EQ), or minimum phase IR

### Parsing

Use standard WAV library. Key considerations:
- Recommended: 32-bit float for precision
- Default: Peak at 1 second from start (unless windowed)
- Sample rate typically 48000 Hz

---

## 6. REW API Data Access

> **Reference**: REW API documentation at http://localhost:4735 (when REW API is running)
> Official docs: https://www.roomeqwizard.com/help/help_en-GB/html/api.html

### API Endpoints for Data Retrieval

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/measurements` | GET | List all measurements |
| `/measurements/:id/frequency-response` | GET | Get frequency response data |
| `/measurements/:id/impulse-response` | GET | Get impulse response data |
| `/measurements/:id/group-delay` | GET | Get group delay data |
| `/measurements/:id/rt60` | GET | Get RT60 data |

### Array Encoding (from official docs)

Arrays are transferred as **Base64-encoded strings** from raw bytes of 32-bit float values.

**Important**: Byte order is **big-endian**.

```python
import base64
import struct

def decode_rew_array(base64_encoded: str) -> list[float]:
    """Decode REW API Base64-encoded float array."""
    raw_bytes = base64.b64decode(base64_encoded)
    # Big-endian 32-bit floats
    count = len(raw_bytes) // 4
    return list(struct.unpack(f'>{count}f', raw_bytes))
```

### Validation Example (from official docs)

```
Base64 string: PgAAAD6AAAA+wAAAPwAAAA==
Float array:   [0.125, 0.25, 0.375, 0.5]
```

---

## Data Validation Requirements

After parsing any format, validate:

| Check | Valid Range | Error |
|-------|-------------|-------|
| Frequency values | 1 Hz - 30,000 Hz | `invalid_frequency` |
| SPL values | -100 dB - +50 dB | `invalid_spl` |
| Phase values | -180° - +360° (may be unwrapped) | `invalid_phase` |
| Array lengths match | freq.length == spl.length | `length_mismatch` |
| Minimum data points | >= 10 points | `insufficient_data` |
| Monotonic frequencies | Each freq > previous | `non_monotonic` |

---

## Normalized Internal Format

After parsing, normalize all measurements to:

```typescript
interface ParsedMeasurement {
  // Source information
  source_format: 'rew_text' | 'rew_ir_text' | 'mdat' | 'wav' | 'api';
  
  // Metadata from file
  metadata: {
    rew_version?: string;
    measurement_name?: string;
    export_date?: string;      // ISO 8601
    source_description?: string;
    excitation?: string;
    frequency_range?: [number, number];  // [min_hz, max_hz]
    notes?: string;
  };
  
  // Frequency response (from FR export or computed from IR)
  frequency_response: {
    frequencies_hz: number[];   // Ascending order
    spl_db: number[];           // Corresponding SPL
    phase_degrees: number[];    // Phase (may be 0 if unavailable)
  };
  
  // Impulse response (from IR export or WAV)
  impulse_response?: {
    samples: number[];          // IR sample values
    sample_rate_hz: number;     // e.g., 48000
    peak_index: number;         // Sample index of peak
    start_time_s: number;       // Time offset of first sample
  };
}
```

---

## External References

- **REW File Menu Documentation**: https://www.roomeqwizard.com/help/help_en-GB/html/file.html
- **REW API Documentation**: https://www.roomeqwizard.com/help/help_en-GB/html/api.html
- **REW Data Import**: https://www.roomeqwizard.com/help/help_en-GB/html/dataimport.html
- **FRD File Format**: Industry-standard frequency response data format
