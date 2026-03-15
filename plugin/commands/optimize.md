---
name: optimize
description: Start or continue an iterative room optimization cycle — get one recommendation at a time, make changes, re-measure, validate.
allowed-tools: ["mcp"]
---

Run the iterative room optimization loop. The core principle is: one change at a time, always measure after, never stack adjustments.

## Initialization

Call `rew.api_connect` with default parameters. If connection fails, stop and tell the user to launch REW with the API enabled.

Check for an active measurement session by calling `rew.api_measurement_session` with action `get_status`. If a session exists, use it. If not, tell the user to run `/rew:calibrate` or `/rew:analyze` first so measurements are available, then stop.

Call `rew.api_list_measurements` to see what measurements are available. Identify the most recent L/R/Sub measurements.

## Optimization Loop

### 1. Get Recommendation

Call `rew.optimize_room` with action `get_recommendation` and the current primary measurement ID. Include `left_measurement_id`, `right_measurement_id`, and `sub_measurement_id` if available.

Present the recommendation to the user:
- **What to change**: the specific action (e.g., "Move left monitor 6 inches away from side wall")
- **Why**: the underlying issue (e.g., "SBIR null at 125 Hz caused by boundary reflection")
- **Expected improvement**: quantified when possible (e.g., "Reduce null depth by 3-6 dB")
- **Fixability**: whether this is a placement, settings, or treatment change
- **Priority rank**: N of M total issues

Tell the user to make this single physical change now. Wait for them to confirm they have done so.

### 2. Re-Measure

After the user confirms the change, guide a re-measurement:

1. Call `rew.api_check_levels` to verify the mic is still getting good signal. If levels have changed (e.g., mic was bumped), address before proceeding.
2. Call `rew.api_measurement_session` with action `measure` for the relevant channel(s). At minimum, re-measure the channel affected by the change.
3. Call `rew.api_measurement_session` with action `get_status` to confirm the new measurement was captured.

### 3. Validate Adjustment

Call `rew.optimize_room` with action `validate_adjustment`. Provide:
- `measurement_id`: the new (post-adjustment) measurement ID
- `pre_measurement_id`: the previous measurement ID (before the adjustment)
- `target_frequency_hz`: the frequency of the issue that was addressed
- `target_category`: the category of the issue (peak, null, sub_integration, lr_symmetry)

Present the validation result:
- **Success**: 50%+ reduction in the issue. Congratulate the user and move to the next issue.
- **Partial**: Some improvement but less than 50%. Suggest trying a larger adjustment or a different approach. Ask if the user wants to try again or move on.
- **Unchanged**: Minimal change. The adjustment may not have been large enough, or this issue may not be addressable with this approach. Suggest an alternative.
- **Worsened**: The change made things worse. Tell the user to revert to the previous position and try a different direction.

### 4. Check Progress

Call `rew.optimize_room` with action `check_progress` and the latest measurement ID.

Present the progress assessment:
- Smoothness zone (how close to the +/-3 dB target)
- L/R balance status (if applicable)
- Sub integration status (if applicable)
- Whether the `should_stop` flag is set (response is in the "good" zone)

### 5. Continue or Stop

If `should_stop` is true or the user is satisfied:
- Present a final summary of all adjustments made and their results
- Suggest running `/rew:analyze` for a fresh comprehensive analysis of the optimized room
- Congratulate the user

If more recommendations remain and the user wants to continue:
- Return to step 1 (Get Recommendation) for the next issue

Always let the user decide whether to continue. Never auto-proceed to the next recommendation without confirmation.

## Key Principles

- **One change at a time**: Never suggest multiple adjustments before re-measuring. Stacking changes makes it impossible to know what helped.
- **Always measure after**: Subjective impressions are unreliable. Measure to confirm.
- **Diminishing returns**: After 3-4 successful adjustments, improvements become smaller. Know when to stop.
- **Revert if worse**: If an adjustment worsens the response, go back. Do not try to compensate with another change.
