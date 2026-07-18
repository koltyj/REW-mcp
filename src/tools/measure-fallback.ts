/**
 * Shared helper for the "no REW Pro licence" measurement fallback.
 *
 * REW rejects API-triggered measurements without a Pro licence (HTTP 401,
 * "A Pro upgrade license is required for this action"). Rather than treat this
 * as a hard failure, the MCP tools return actionable guidance: the user runs
 * the measurement manually in REW's Measure dialog, then tells the assistant to
 * continue. The assistant relays the concrete settings to use.
 */

export interface ManualMeasureSettings {
  /** Measurement level in dBFS. */
  level_dbfs?: number;
  /** Sweep start frequency in Hz. */
  start_freq_hz?: number;
  /** Sweep end frequency in Hz. */
  end_freq_hz?: number;
  /** Sweep length (REW string, e.g. "256k"). */
  sweep_length?: string;
}

/**
 * Build a user-facing instruction for taking a measurement by hand in REW.
 * The message is deliberately step-by-step so the assistant can relay it and
 * then resume once the user confirms the measurement exists.
 */
export function manualMeasureGuidance(settings?: ManualMeasureSettings): string {
  const parts: string[] = [];
  if (settings?.level_dbfs !== undefined) parts.push(`level ${settings.level_dbfs} dBFS`);
  if (settings?.start_freq_hz !== undefined && settings?.end_freq_hz !== undefined) {
    parts.push(`sweep ${settings.start_freq_hz} Hz to ${settings.end_freq_hz} Hz`);
  }
  if (settings?.sweep_length !== undefined) parts.push(`length ${settings.sweep_length}`);
  const settingsText = parts.length > 0 ? ` Use these settings: ${parts.join(', ')}.` : '';

  return (
    'This REW instance does not have the Pro licence required for API-triggered measurements. ' +
    'Please take the measurement manually in REW: open the Measure dialog, ' +
    'configure it as advised, and start the sweep.' +
    settingsText +
    ' When the measurement has finished and appears in REW, tell the assistant to continue and it will pick up the new measurement.'
  );
}
