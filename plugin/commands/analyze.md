---
name: analyze
description: Analyze existing room measurements with prioritized recommendations. Works with both live REW data and imported text exports.
allowed-tools: ["mcp"]
argument-hint: "[measurement_file_path] (optional — uses live REW data if not specified)"
---

Analyze room measurements and present prioritized recommendations. Determine the data source based on whether an argument (file path) is provided.

## Branch A: File Import (argument provided)

If the user provides a file path as the argument:

1. Read the file contents from disk.
2. Call `rew.ingest_measurement` with the file contents and appropriate metadata. Ask the user for the speaker ID (L, R, Sub, Combined) and condition label if not obvious from the filename.
3. Note the returned measurement ID for analysis.
4. Proceed to the Analysis section below.

## Branch B: Live REW Data (no argument)

If no argument is provided:

1. Call `rew.api_connect` with default parameters. If connection fails, tell the user to launch REW with the API enabled.
2. Call `rew.api_list_measurements` to enumerate available measurements.
3. Present the measurement list to the user with names, dates, and indices.
4. Ask the user to select which measurement(s) to analyze. Accept one primary measurement and optionally L/R/Sub designations.
5. For each selected measurement, call `rew.api_get_measurement` using the measurement UUID to fetch the data.
6. Call `rew.ingest_measurement` for each fetched measurement to store it for analysis. Use the measurement name from REW to infer speaker ID and condition.
7. Proceed to the Analysis section below.

## Analysis

Call `rew.analyze_room` with the collected measurement IDs:
- `measurement_id`: the primary measurement
- `left_measurement_id` and `right_measurement_id`: if L and R measurements are available
- `sub_measurement_id`: if a subwoofer measurement is available
- `room_dimensions`: ask the user for room dimensions (length, width, height in feet) if not previously provided. If the user declines, omit this parameter -- the analysis still works without it but skips room mode correlation.

Present the analysis results:

### Overall Assessment
- Overall severity rating and summary
- Number of analysis sections completed

### Prioritized Recommendations
Present each recommendation from the `top_recommendations` array as a numbered list:
1. Priority rank
2. Action to take
3. Expected impact
4. Fixability category (placement, settings, treatment, unfixable)
5. Why this is ranked where it is (priority score context)

### Section Details
For each completed analysis section (peaks/nulls, room modes, sub integration, L/R symmetry, GLM comparison), present:
- Summary
- Severity
- Key data points

## Target Curve Comparison

Call `rew.compare_to_target` with the primary measurement ID. Default to `rew_room_curve` target type for studio monitoring. Present the deviation statistics and whether the response falls within acceptable limits.

## GLM Context (conditional)

If the analysis results include GLM comparison data with persistent issues, or if the user mentions Genelec/GLM, call `rew.interpret_with_glm_context` with the primary measurement ID.

Present:
- What GLM successfully corrected
- What remains beyond GLM scope
- Calibration quality verdict

## Next Steps

Based on the analysis results, recommend the appropriate next action:
- If significant issues found: suggest `/rew:optimize` to start iterative correction
- If moderate issues: suggest targeted adjustments from the recommendations list
- If minor/negligible: congratulate the user -- the room is well-calibrated
