# rew.api_spl_meter

Control REW's SPL meter via API.

## Description

Monitor sound pressure levels in real-time with configurable weighting curves (A, C, Z) and time responses (Slow, Fast, Impulse). Useful for level calibration and monitoring during measurements.

## Prerequisites

- Connected to REW API via `rew.api_connect`
- Audio input device configured (measurement mic)

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["start", "stop", "read", "configure"],
      "description": "SPL meter action"
    },
    "meter_id": {
      "type": "integer",
      "minimum": 1,
      "maximum": 4,
      "default": 1,
      "description": "SPL meter ID (REW Pro supports up to 4)"
    },
    "config": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": ["SPL", "Leq", "SEL"],
          "description": "Display mode"
        },
        "weighting": {
          "type": "string",
          "enum": ["A", "C", "Z"],
          "description": "Frequency weighting"
        },
        "filter": {
          "type": "string",
          "enum": ["Slow", "Fast", "Impulse"],
          "description": "Time weighting"
        }
      }
    }
  },
  "required": ["action"]
}
```

## Actions

### start
Start the SPL meter. Optionally configure settings first.

### stop
Stop the SPL meter.

### read
Read current SPL levels.

### configure
Get or set SPL meter configuration.

## Weighting Curves

- **A-weighting**: Approximates human hearing sensitivity. Best for general noise measurements.
- **C-weighting**: Flatter response, better for low frequencies. Good for peak measurements and music.
- **Z-weighting**: Unweighted (flat). Best for acoustic measurements and calibration.

## Time Weighting

- **Slow**: 1 second time constant. Good for steady sounds.
- **Fast**: 125ms time constant. Better for varying sounds.
- **Impulse**: 35ms rise, 1.5s decay. For impulsive sounds.

## Examples

### Start SPL meter with C-weighting
```json
{
  "action": "start",
  "config": {
    "weighting": "C",
    "filter": "Slow"
  }
}
```

### Read current level
```json
{
  "action": "read"
}
```

### Stop meter
```json
{
  "action": "stop"
}
```

## Output

### read action
```json
{
  "action": "read",
  "success": true,
  "message": "SPL: 75.3 dBC",
  "meter_id": 1,
  "levels": {
    "spl_db": 75.3,
    "leq_db": 74.8,
    "sel_db": 92.1,
    "weighting": "C",
    "filter": "Slow"
  }
}
```

## Measurement Values

- **SPL**: Current instantaneous sound pressure level
- **Leq**: Equivalent continuous sound level (time-averaged)
- **SEL**: Sound exposure level (total energy normalized to 1 second)

## Use Cases

1. **Level Calibration**: Set target SPL (e.g., 75 dBC) for measurements
2. **Reference Level Setup**: Calibrate to broadcast standards (-20 dBFS = 85 dBC)
3. **Live Monitoring**: Watch levels during measurements
4. **Room Analysis**: Check ambient noise floor

## Related Tools

- `rew.api_connect` - Connect to REW API
- `rew.api_audio` - Configure audio devices
- `rew.api_generator` - Generate test signals
- `rew.api_measure` - Run measurements
