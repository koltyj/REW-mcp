# rew.api_audio

Configure REW audio devices via API.

## Description

Configure input and output audio devices, sample rates, and view current audio status. Essential for setting up measurement microphones and playback devices before taking measurements.

## Prerequisites

- Connected to REW API via `rew.api_connect`

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["status", "list_devices", "set_input", "set_output", "set_sample_rate"],
      "description": "Audio configuration action"
    },
    "device": {
      "type": "string",
      "description": "Device name (for set_input or set_output)"
    },
    "sample_rate": {
      "type": "number",
      "description": "Sample rate in Hz (for set_sample_rate)"
    }
  },
  "required": ["action"]
}
```

## Actions

### status
Get current audio configuration including active devices and sample rate.

### list_devices
List all available input devices, output devices, and supported sample rates.

### set_input
Set the input device (measurement microphone).

### set_output
Set the output device (playback for sweeps/test signals).

### set_sample_rate
Set the audio sample rate.

## Examples

### Get audio status
```json
{
  "action": "status"
}
```

### List available devices
```json
{
  "action": "list_devices"
}
```

### Set input device
```json
{
  "action": "set_input",
  "device": "UMIK-1"
}
```

### Set sample rate
```json
{
  "action": "set_sample_rate",
  "sample_rate": 48000
}
```

## Output

### status action
```json
{
  "action": "status",
  "success": true,
  "audio_status": {
    "enabled": true,
    "ready": true,
    "driver": "Java",
    "sample_rate": 48000,
    "current_input": "UMIK-1",
    "current_output": "Built-in Output"
  },
  "input_calibration": {...}
}
```

### list_devices action
```json
{
  "action": "list_devices",
  "success": true,
  "available_devices": {
    "input_devices": ["Default Device", "UMIK-1", "Built-in Microphone"],
    "output_devices": ["Default Device", "Built-in Output", "External DAC"],
    "sample_rates": [44100, 48000, 88200, 96000]
  }
}
```

## Related Tools

- `rew.api_connect` - Connect to REW API
- `rew.api_measure` - Control measurements
- `rew.api_generator` - Control signal generator
