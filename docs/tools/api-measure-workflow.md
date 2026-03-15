# rew.api_measure_workflow

Complete measurement workflow orchestration for automated testing.

## Description

This tool provides end-to-end measurement workflow automation. It handles:
- Device discovery and configuration
- Level checking and calibration
- Measurement execution with proper settings
- Result retrieval and verification

**Important**: Sweep measurements require a REW Pro license.

## Prerequisites

- Connected to REW API via `rew.api_connect`
- REW Pro license for automated sweep measurements

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["setup", "check_levels", "calibrate_level", "measure", "measure_sequence", "get_status"]
    },
    "setup": {
      "type": "object",
      "properties": {
        "input_device": { "type": "string" },
        "output_device": { "type": "string" },
        "sample_rate": { "type": "number" },
        "use_blocking": { "type": "boolean", "default": true }
      }
    },
    "measurement": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "level_dbfs": { "type": "number", "default": -12 },
        "start_freq_hz": { "type": "number", "default": 20 },
        "end_freq_hz": { "type": "number", "default": 20000 },
        "target_spl_db": { "type": "number" },
        "output_channel": { "type": "string", "enum": ["left", "right", "both"] }
      }
    },
    "sequence": {
      "type": "object",
      "properties": {
        "measurements": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "output_channel": { "type": "string" },
              "notes": { "type": "string" }
            }
          }
        },
        "delay_between_ms": { "type": "number", "default": 2000 }
      }
    }
  },
  "required": ["action"]
}
```

## Actions

### get_status
Get current workflow status including device configuration, measurement count, and calibration status.

### setup
Configure audio devices for measurement. Auto-detects measurement microphones if not specified.

### check_levels
Verify signal chain levels before measurement. Generates pink noise and checks for clipping.

### calibrate_level
Auto-calibrate output level to achieve target SPL (requires SPL meter running).

### measure
Execute a single sweep measurement.

### measure_sequence
Execute multiple measurements in sequence (e.g., Left/Right speakers, multiple positions).

## Complete Workflow Example

```javascript
// 1. Connect to REW API
await rew.api_connect({ port: 4735 });

// 2. Check current status
await rew.api_measure_workflow({ action: "get_status" });

// 3. Setup devices (auto-detect or specify)
await rew.api_measure_workflow({
  action: "setup",
  setup: {
    input_device: "UMIK-1",
    output_device: "Universal Audio Thunderbolt",
    sample_rate: 48000
  }
});

// 4. Check levels before measuring
await rew.api_measure_workflow({
  action: "check_levels",
  measurement: { level_dbfs: -12 }
});

// 5. Execute measurement
await rew.api_measure_workflow({
  action: "measure",
  measurement: {
    name: "Left Speaker - Listening Position",
    level_dbfs: -12,
    start_freq_hz: 20,
    end_freq_hz: 20000
  }
});

// 6. Or execute a sequence
await rew.api_measure_workflow({
  action: "measure_sequence",
  measurement: { level_dbfs: -12 },
  sequence: {
    measurements: [
      { name: "Left Speaker", output_channel: "left" },
      { name: "Right Speaker", output_channel: "right" }
    ],
    delay_between_ms: 3000
  }
});
```

## Output Examples

### get_status
```json
{
  "action": "get_status",
  "success": true,
  "message": "Ready for measurements (2 existing)",
  "status": {
    "connected": true,
    "audio_ready": true,
    "input_device": "UMIK-1",
    "output_device": "Universal Audio Thunderbolt",
    "sample_rate": 48000,
    "blocking_mode": true,
    "current_level_dbfs": -12,
    "measurement_count": 2,
    "pro_features": true,
    "mic_calibrated": true,
    "cal_sensitivity_db": -18.5
  }
}
```

### measure
```json
{
  "action": "measure",
  "success": true,
  "message": "Measurement completed in 5234ms",
  "measurements": [{
    "success": true,
    "uuid": "abc123-def456",
    "name": "Left Speaker",
    "duration_ms": 5234
  }]
}
```

### measure_sequence
```json
{
  "action": "measure_sequence",
  "success": true,
  "message": "Completed 2/2 measurements",
  "measurements": [
    { "success": true, "uuid": "abc123", "name": "Left Speaker", "duration_ms": 5100 },
    { "success": true, "uuid": "def456", "name": "Right Speaker", "duration_ms": 5200 }
  ]
}
```

## Warnings and Diagnostics

The tool provides warnings for common issues:
- No microphone calibration file loaded
- Blocking mode disabled
- Level too high (clipping risk)
- Level too low (poor SNR)
- PRO license required for measurements

## Related Tools

- `rew.api_connect` - Connect to REW API
- `rew.api_audio` - Manual audio device configuration
- `rew.api_generator` - Signal generator control
- `rew.api_spl_meter` - SPL monitoring
- `rew.api_get_measurement` - Retrieve measurement data after capture
