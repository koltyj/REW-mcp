# rew.analyze_sub_integration

Analyze subwoofer integration with main speakers.

## Description

Evaluates phase alignment, timing, and polarity at the crossover region.
Provides delay and polarity recommendations for optimal summation.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "mains_measurement_id": {
      "type": "string",
      "description": "Measurement ID for main speakers only (no sub)"
    },
    "sub_measurement_id": {
      "type": "string",
      "description": "Measurement ID for subwoofer only (no mains)"
    },
    "combined_measurement_id": {
      "type": "string",
      "description": "Optional: Measurement ID for mains + sub combined"
    },
    "crossover_hz": {
      "type": "number",
      "minimum": 40,
      "maximum": 200,
      "description": "Crossover frequency. If omitted, will estimate."
    },
    "current_sub_delay_ms": {
      "type": "number",
      "default": 0,
      "description": "Current delay applied to subwoofer"
    },
    "current_sub_polarity": {
      "type": "string",
      "enum": ["normal", "inverted"],
      "default": "normal"
    }
  },
  "required": ["mains_measurement_id", "sub_measurement_id"]
}
```

## Output

Returns analysis with:
- `crossover_analysis` - Detected crossover, phase alignment quality
- `timing_recommendations` - Optimal delay adjustment
- `polarity_recommendation` - Whether to invert polarity
- `summation_prediction` - Expected improvement at crossover
- `recommendations` - Human-readable action items

## Workflow

1. Measure mains solo (sub off)
2. Measure sub solo (mains off)
3. Call this tool with both measurement IDs
4. Apply recommended delay and polarity
5. Verify with combined measurement
