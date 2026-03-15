# rew.api_measure

Control REW measurements via API.

## Description

Execute and configure REW measurements remotely. Supports sweep measurements, SPL measurements, and measurement configuration.

**Important**: Automated sweep measurements require a REW Pro license. SPL and level checking work without Pro.

## Prerequisites

- Connected to REW API via `rew.api_connect`
- Audio devices configured (see `rew.api_audio`)
- REW Pro license for sweep measurements

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["status", "sweep", "spl", "cancel", "configure"],
      "description": "Measurement action to perform"
    },
    "config": {
      "type": "object",
      "properties": {
        "level_db": {
          "type": "number",
          "minimum": -60,
          "maximum": 0,
          "description": "Measurement level in dBFS"
        },
        "start_freq_hz": {
          "type": "number",
          "description": "Sweep start frequency in Hz"
        },
        "end_freq_hz": {
          "type": "number", 
          "description": "Sweep end frequency in Hz"
        },
        "sweep_length": {
          "type": "number",
          "description": "Sweep length in samples"
        },
        "notes": {
          "type": "string",
          "description": "Notes to attach to measurement"
        }
      }
    }
  },
  "required": ["action"]
}
```

## Actions

### status
Get current measurement configuration and available commands.

### configure
Set measurement parameters without triggering a measurement.

### sweep
Trigger a sweep measurement. Requires REW Pro license.

### spl
Trigger an SPL measurement.

### cancel
Cancel an in-progress measurement.

## Examples

### Get measurement status
```json
{
  "action": "status"
}
```

### Configure and run sweep
```json
{
  "action": "sweep",
  "config": {
    "level_db": -12,
    "start_freq_hz": 20,
    "end_freq_hz": 20000,
    "notes": "Left speaker measurement"
  }
}
```

### Cancel measurement
```json
{
  "action": "cancel"
}
```

## Related Tools

- `rew.api_connect` - Connect to REW API
- `rew.api_audio` - Configure audio devices
- `rew.api_generator` - Control signal generator
- `rew.api_spl_meter` - SPL meter for level monitoring
