# rew.compare_to_target

Compare a measurement against a target response curve.

## Description

Calculates deviation from a target curve and provides assessment.
Supports built-in curves and custom house curves.

## Built-in Target Curves

| Curve | Description |
|-------|-------------|
| `flat` | 0 dB across all frequencies |
| `rew_room_curve` | LF rise + HF fall per REW docs |
| `harman` | ~3 dB bass shelf, slight HF roll-off |
| `bk_house` | B&K studio mixing reference |
| `custom` | User-defined frequency/dB pairs |

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "measurement_id": {
      "type": "string",
      "description": "ID of measurement to compare"
    },
    "target_type": {
      "type": "string",
      "enum": ["flat", "rew_room_curve", "harman", "bk_house", "custom"],
      "default": "flat"
    },
    "custom_curve_points": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "frequency_hz": { "type": "number" },
          "level_db": { "type": "number" }
        }
      },
      "description": "Required for custom target type"
    },
    "alignment_frequency_hz": {
      "type": "number",
      "default": 1000,
      "description": "Frequency for level alignment"
    },
    "evaluation_range_hz": {
      "type": "array",
      "default": [20, 20000],
      "description": "Frequency range for evaluation"
    }
  },
  "required": ["measurement_id"]
}
```

## Output

Returns deviation analysis:
- `deviation_statistics` - Average, max, RMS deviations
- `by_band` - Per-band analysis (bass, mid, treble)
- `worst_deviations` - Top 5 peaks/nulls
- `overall_grade` - excellent/good/acceptable/needs_work/poor
- `recommendations` - Suggested improvements

## Reference

REW EQ Window Documentation:
https://www.roomeqwizard.com/help/help_en-GB/html/eqwindow.html
