---
name: calibrate
description: Run the full studio monitor calibration workflow — mic setup, level check, SPL calibration, L/R/Sub measurement, analysis, and optimization guidance.
allowed-tools: ["mcp"]
argument-hint: "[target_spl] (default: 85)"
---

Execute the full studio monitor calibration workflow end-to-end. Parse the optional argument as the target SPL in dB (default to 85 if not provided). Report status to the user after each step before proceeding to the next.

## Step 1: Connect to REW

Call `rew.api_connect` with default parameters. If the connection fails, tell the user to launch REW with the `-api` flag or enable the API in REW preferences, then stop.

Report the REW version and number of existing measurements.

## Step 2: Configure Audio Devices

Call `rew.api_audio` with action `list_devices` to enumerate available inputs and outputs.

Present the device list to the user. Ask them to confirm which input (measurement mic) and output (monitor interface) to use. Then call `rew.api_audio` with action `set_input` and `set_output` for the selected devices.

Call `rew.api_audio` with action `status` to confirm the configuration took effect.

## Step 3: Check Input Levels

Call `rew.api_check_levels` to read mic input levels.

Interpret the returned zone:
- **CLIPPING** or **HOT**: Tell the user to reduce mic preamp gain by the amount indicated, then re-check.
- **OPTIMAL**: Proceed.
- **LOW** or **VERY_LOW**: Tell the user to increase mic preamp gain, then re-check.

Repeat level checks until the zone is OPTIMAL. Do not proceed past this step if the zone is CLIPPING or VERY_LOW (these block measurement).

## Step 4: Calibrate SPL

Call `rew.api_calibrate_spl` with action `start` and the target SPL from the argument (or 85). Use C-weighting.

Then call `rew.api_calibrate_spl` with action `check` to read the current SPL level and get adjustment guidance.

Report the current SPL, target SPL, and the adjustment needed. Tell the user to adjust their monitor controller volume accordingly.

After the user confirms they have adjusted, call `check` again to verify. Repeat until the calibration status shows `within_tolerance: true`.

Once calibrated, call `rew.api_calibrate_spl` with action `stop`.

## Step 5: Measure L/R/Sub

Call `rew.api_measurement_session` with action `start_session` and notes describing this calibration session.

For each channel in order (left, right, sub):
1. Tell the user which speaker to solo or which output to route.
2. Call `rew.api_measurement_session` with action `measure` and the appropriate `channel` value (`left`, `right`, or `sub`).
3. Report the measurement result and any guidance returned.
4. Call `rew.api_measurement_session` with action `get_status` to confirm the measurement was captured.

If the user does not have a subwoofer, skip the sub measurement. Ask before assuming.

## Step 6: Analyze Room

Call `rew.analyze_room` with the measurement IDs from the session. Provide:
- `measurement_id`: the primary (combined or left) measurement
- `left_measurement_id` and `right_measurement_id` for L/R symmetry analysis
- `sub_measurement_id` if a sub was measured

Present the overall summary and severity to the user.

## Step 7: GLM Context (if applicable)

If the user has Genelec monitors with GLM, call `rew.interpret_with_glm_context` with the measurement ID to get GLM-aware interpretation.

Present which issues GLM can address and which require physical intervention.

If the user does not use GLM, skip this step.

## Step 8: Optimization Recommendations

Call `rew.optimize_room` with action `get_recommendation` and the primary measurement ID to get the top priority recommendation.

Present the recommendation clearly:
- What to change
- Why it matters
- Expected improvement
- Fixability category (placement, settings, treatment)

Tell the user they can run `/rew:optimize` to start the iterative optimization cycle based on these findings.

## Summary

Present a final calibration summary:
- Audio device configuration
- SPL calibration result (target vs. achieved)
- Measurements taken (L/R/Sub)
- Overall room severity rating
- Top recommendation to address first
- Suggested next step
