# rew_api_generator

Control REW's signal generator via API.

## Description

Generate test signals including sine tones, pink noise, white noise, sweeps, and more. Useful for level calibration, frequency response testing, and speaker evaluation.

## Prerequisites

- Connected to REW API via `rew_api_connect`
- Audio output device configured (see `rew_api_audio`)

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["status", "start", "stop", "set_signal", "set_level", "set_frequency", "list_signals"],
      "description": "Generator action to perform"
    },
    "_signal_note": "Use a valid REW signal name from list_signals (e.g. pinknoise, whitenoise, sine, logsweep) — not a display string like 'Pink noise'.",
    "signal": {
      "type": "string",
      "description": "Signal type (for set_signal)"
    },
    "level_db": {
      "type": "number",
      "minimum": -60,
      "maximum": 0,
      "description": "Output level in dBFS"
    },
    "frequency_hz": {
      "type": "number",
      "minimum": 20,
      "maximum": 20000,
      "description": "Frequency in Hz (for tone signals)"
    }
  },
  "required": ["action"]
}
```

## Actions

### status
Get current generator status including signal type, level, and playing state.

### list_signals
List all available signal types.

### start
Start the signal generator.

### stop
Stop the signal generator.

### set_signal
Change the signal type (e.g., "Pink noise", "Sine", "White noise").

### set_level
Set the output level in dBFS.

### set_frequency
Set the frequency for tone signals.

## Common Signals

- `sine` - Pure sine wave tone
- `Pink noise` - Pink noise (equal energy per octave)
- `White noise` - White noise (equal energy per Hz)
- `square` - Square wave
- `sweep` - Log sweep

## Examples

### Get generator status
```json
{
  "action": "status"
}
```

### Start pink noise at -20 dBFS
```json
{
  "action": "set_signal",
  "signal": "Pink noise"
}
```
```json
{
  "action": "set_level",
  "level_db": -20
}
```
```json
{
  "action": "start"
}
```

### Generate 1kHz tone
```json
{
  "action": "set_signal",
  "signal": "sine"
}
```
```json
{
  "action": "set_frequency",
  "frequency_hz": 1000
}
```
```json
{
  "action": "start"
}
```

### Stop generator
```json
{
  "action": "stop"
}
```

## Use Cases

1. **Level Calibration**: Generate pink noise to set SPL levels
2. **Frequency Testing**: Use sine waves to check specific frequencies
3. **Room Mode Identification**: Sweep through bass frequencies to find resonances
4. **Speaker Testing**: Use test signals to evaluate speaker performance

## Related Tools

- `rew_api_connect` - Connect to REW API
- `rew_api_audio` - Configure audio devices
- `rew_api_spl_meter` - Monitor output levels
