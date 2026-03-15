# rew.average_measurements

Create a spatial average from multiple measurement positions.

## Description

Implements REW's averaging methods for combining multiple measurements:
- **RMS** (incoherent) - Recommended for spatial averaging from different positions
- **dB** - Simple arithmetic average in dB domain
- **Vector** (coherent) - Requires phase data, best for same-position measurements
- **Hybrid** methods - rms_phase, db_phase

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "measurement_ids": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 2,
      "maxItems": 16,
      "description": "IDs of measurements to average (2-16 measurements)"
    },
    "method": {
      "type": "string",
      "enum": ["rms", "db", "vector", "rms_phase", "db_phase"],
      "default": "rms",
      "description": "Averaging method"
    },
    "align_spl": {
      "type": "boolean",
      "default": true,
      "description": "Align SPL levels before averaging"
    },
    "alignment_range_hz": {
      "type": "array",
      "items": { "type": "number" },
      "default": [200, 2000],
      "description": "Frequency range for SPL alignment [min, max] Hz"
    },
    "weights": {
      "type": "array",
      "items": { "type": "number" },
      "description": "Optional per-measurement weights (0-1)"
    },
    "store_result": {
      "type": "boolean",
      "default": true,
      "description": "Store the averaged measurement for further analysis"
    }
  },
  "required": ["measurement_ids"]
}
```

## Output

Returns averaged measurement with:
- `averaged_measurement_id` - ID of stored averaged measurement
- `method_used` - Averaging method applied
- `alignment_offsets_db` - SPL alignment offsets applied
- `quick_stats` - Bass/mid/treble statistics
- `warnings` - Any issues detected

## Reference

Based on REW All SPL Graph documentation:
https://www.roomeqwizard.com/help/help_en-GB/html/graph_allspl.html
