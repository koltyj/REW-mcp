/**
 * Zod schemas for REW API response validation
 *
 * These schemas provide runtime validation and type inference
 * for data received from the REW API.
 */

import { z } from 'zod';

// Input calibration schema (used in api-audio.ts)
export const InputCalibrationSchema = z.object({
  enabled: z.boolean().optional(),
  gain_db: z.number().optional(),
  offset_db: z.number().optional(),
  calibration_file: z.string().optional(),
  sensitivity_db: z.number().optional(),
  calDataAllInputs: z.object({
    calFilePath: z.string().optional(),
    dBFSAt94dBSPL: z.number().optional()
  }).optional()
}).passthrough();  // Allow additional fields from API

export type InputCalibration = z.infer<typeof InputCalibrationSchema>;

// Generic API response wrapper
export const REWApiResponseSchema = z.object({
  status: z.number(),
  data: z.unknown().optional(),
  error: z.string().optional()
});

export type REWApiResponse = z.infer<typeof REWApiResponseSchema>;

// Measurement info from list endpoint
export const MeasurementInfoSchema = z.object({
  uuid: z.string(),
  // REW's /measurements endpoint labels measurements with `title`, not `name`,
  // so `name` must be optional for real REW responses to parse.
  name: z.string().optional(),
  index: z.number().optional(),
  type: z.string().optional(),
  has_ir: z.boolean().optional(),
  has_fr: z.boolean().optional(),
  title: z.string().optional(),
  id: z.string().optional(),
  hasImpulse: z.boolean().optional(),
  hasFrequencyResponse: z.boolean().optional()
}).passthrough();

export type MeasurementInfo = z.infer<typeof MeasurementInfoSchema>;

// Array of measurements
export const MeasurementArraySchema = z.array(MeasurementInfoSchema);

// Sweep configuration (used in api-measure.ts and api-measure-workflow.ts)
export const SweepConfigSchema = z.object({
  startFreq: z.number().optional(),
  endFreq: z.number().optional(),
  level: z.number().optional(),
  length: z.number().optional(),
  sweepType: z.string().optional(),
  timing: z.string().optional(),
  fillSilenceWithDither: z.boolean().optional()
}).passthrough();

export type SweepConfig = z.infer<typeof SweepConfigSchema>;

// Sweep configuration as exposed by REW API 0.9.5
// (GET/POST /measure/sweep/configuration → MeasSweepConfiguration).
// Note: `length` is a string enum (e.g. "128k", "1M") from
// /measure/sweep/configuration/sweep-lengths, not a sample count.
export interface MeasSweepConfiguration {
  startFrequency?: number;
  endFrequency?: number;
  length?: string;
  fillSilenceWithDither?: boolean;
}

// /measure/level → Value { value, unit }
export interface MeasureValue {
  value?: number;
  unit?: string;
}

// /measure/naming → MeasurementNaming
export interface MeasurementNaming {
  title?: string;
  namingOption?: string;
  nextNumber?: number;
  numberIncrement?: number;
  dateTimeFormat?: string;
  prefixMeasNameWithOutput?: boolean;
  appendLevelToMeasName?: boolean;
}

// Result of executeMeasureCommand; proLicenseRequired flags the no-Pro 401.
export interface MeasureCommandResult {
  success: boolean;
  status: number;
  message?: string;
  data?: unknown;
  proLicenseRequired?: boolean;
}

/**
 * Generic result of a command execution endpoint (`.../command`). The `data`
 * payload varies by command, so it is intentionally left as `unknown`.
 */
export interface CommandExecutionResult {
  success: boolean;
  status: number;
  data?: unknown;
}

// Measure level schema
export const MeasureLevelSchema = z.object({
  level: z.number().optional(),
  value: z.number().optional(),
  unit: z.string().optional()
}).passthrough();

export type MeasureLevel = z.infer<typeof MeasureLevelSchema>;

// Input levels response from /input-levels/last-levels
export const InputLevelsSchema = z.object({
  unit: z.string(),
  rms: z.array(z.number()),       // RMS level per channel
  peak: z.array(z.number()),      // Peak level per channel
  timeSpanSeconds: z.number()     // Averaging window
}).passthrough();

export type InputLevelsResponse = z.infer<typeof InputLevelsSchema>;

// Normalized interface for internal use
export interface InputLevels {
  unit: string;
  rms_levels: number[];
  peak_levels: number[];
  time_span_seconds: number;
}

// EQ default settings — REW API 0.9.5 replaced the single /eq/defaults blob
// with four typed endpoints (default-equaliser, default-target-settings,
// default-target-level, default-room-curve-settings).
export interface EqualiserEntry {
  manufacturer: string;
  model: string;
}

export interface EqTargetSettings {
  shape?: string;
  bassManagementSlopedBPerOctave?: number;
  bassManagementCutoffHz?: number;
  lowFreqSlopedBPerOctave?: number;
  lowFreqCutoffHz?: number;
  lowPassCrossoverType?: string;
  highPassCrossoverType?: string;
  lowPassCutoffHz?: number;
  highPassCutoffHz?: number;
}

export interface EqRoomCurveSettings {
  addRoomCurve?: boolean;
  lowFreqRiseStartHz?: number;
  lowFreqRiseEndHz?: number;
  lowFreqRiseSlopedBPerOctave?: number;
  highFreqFallStartHz?: number;
  highFreqFallSlopedBPerOctave?: number;
}

// Composite view aggregating the four EQ default endpoints.
export interface EQDefaults {
  equaliser?: EqualiserEntry;
  targetSettings?: EqTargetSettings;
  targetLevel?: number;
  roomCurveSettings?: EqRoomCurveSettings;
}

// SPL meter live readout (/spl-meter/{id}/levels → SPLValues).
export interface SPLValues {
  meterNumber?: number;
  splWeighting?: string;
  leqWeighting?: string;
  selWeighting?: string;
  filter?: string;
  spl?: number;
  leq?: number;
  sel?: number;
  isRollingLeq?: boolean;
  rollingLeqMinutes?: number;
  leq1m?: number;
  leq10m?: number;
  lcPeak?: number;
  lzPeak?: number;
  elapsedTime?: number;
}

// SPL meter configuration (/spl-meter/{id}/configuration → SPLMeterConfiguration).
// Note: `filter` is the time weighting (Fast/Slow); the frequency weighting
// (A/C/Z) is split across splWeighting/leqWeighting/selWeighting.
export interface SPLMeterConfiguration {
  showSPL?: boolean;
  showLeq?: boolean;
  showSEL?: boolean;
  splWeighting?: string;
  leqWeighting?: string;
  selWeighting?: string;
  filter?: string;
  highPassActive?: boolean;
  rollingLeqActive?: boolean;
  rollingLeqMinutes?: number;
}

// Friendly config accepted by the client; convenience aliases are expanded to
// the real SPLMeterConfiguration fields before posting.
export interface SPLMeterConfigInput extends SPLMeterConfiguration {
  /** Sets splWeighting/leqWeighting/selWeighting together (A/C/Z). */
  weighting?: string;
  /** 'SPL' | 'Leq' | 'SEL' → showSPL/showLeq/showSEL. */
  mode?: string;
}

// Decoded RTA captured data (/rta/captured-data, /rta/captured-peak-data).
// REW returns a FrequencyResponse whose magnitude/phase are base64 float32
// arrays; this is the decoded, caller-friendly form. When RTA has no snapshot
// REW returns `{ message: "There is no data" }`, surfaced via `message`.
export interface RTACapturedData {
  message?: string;
  unit?: string;
  smoothing?: string;
  frequencies_hz: number[];
  magnitude_db: number[];
  phase_degrees?: number[];
  nanotime?: number;
  total_samples_processed?: number;
}

// REW client type (for workflow functions that accept client parameter)
// This is a structural type, not validation - client is internal
export interface REWClientLike {
  getAudioStatus(): Promise<unknown>;
  getSampleRate(): Promise<number>;
  getJavaInputDevice(): Promise<string | null>;
  getJavaOutputDevice(): Promise<string | null>;
  getJavaInputDevices(): Promise<string[]>;
  getJavaOutputDevices(): Promise<string[]>;
  getAvailableSampleRates(): Promise<number[]>;
  setJavaInputDevice(device: string): Promise<boolean>;
  setJavaOutputDevice(device: string): Promise<boolean>;
  setSampleRate(rate: number): Promise<boolean>;
  getInputCalibration(): Promise<unknown>;
  getBlockingMode(): Promise<boolean>;
  setBlockingMode(enabled: boolean): Promise<boolean>;
  getMeasurementCount?(): Promise<number>;
  listMeasurements(): Promise<unknown[]>;
  getMeasureLevel(): Promise<MeasureValue>;
  setMeasureLevel(level: number, unit?: string): Promise<boolean>;
  getSweepConfig(): Promise<MeasSweepConfiguration>;
  setSweepConfig(config: MeasSweepConfiguration): Promise<boolean>;
  setMeasureNotes(notes: string): Promise<boolean>;
  getMeasureCommands(): Promise<string[]>;
  executeMeasureCommand(command: string, parameters?: string[]): Promise<MeasureCommandResult>;
  setGeneratorSignal(signal: string): Promise<boolean>;
  setGeneratorLevel(level: number, unit?: string): Promise<boolean>;
  executeGeneratorCommand(command: string): Promise<boolean>;
  getSPLMeterLevels(meterId: number): Promise<SPLValues>;
  getInputLevelCommands(): Promise<string[]>;
  startInputLevelMonitoring(): Promise<boolean>;
  stopInputLevelMonitoring(): Promise<boolean>;
  getInputLevelUnits(): Promise<string[]>;
  getInputLevels(): Promise<InputLevels | null>;
  // P1 additions
  getMeasurementCommands?(uuid: string): Promise<string[]>;
  executeMeasurementCommand?(uuid: string, command: string, parameters?: string[]): Promise<unknown>;
  getGroupDelay?(uuid: string, options?: unknown): Promise<unknown>;
  getDistortion?(uuid: string): Promise<unknown>;
  getSelectedMeasurement?(): Promise<string | null>;
  setSelectedMeasurement?(uuid: string): Promise<boolean>;
  getOutputCalibration?(): Promise<unknown>;
  getMeasurementFilters?(uuid: string): Promise<unknown[]>;
  setMeasurementFilters?(uuid: string, filters: unknown[]): Promise<boolean>;
  matchTarget?(uuid: string): Promise<{ success: boolean }>;
  // P2 additions
  listGroups?(): Promise<unknown[]>;
  createGroup?(name: string): Promise<{ id: string }>;
  getRTACommands?(): Promise<string[]>;
  executeRTACommand?(command: string): Promise<{ success: boolean; status: number }>;
  importFrequencyResponseFile?(filePath: string): Promise<{ success: boolean; uuid?: string }>;
  importImpulseResponseFile?(filePath: string): Promise<{ success: boolean; uuid?: string }>;
}

// Group delay data schema
export const GroupDelaySchema = z.object({
  frequencies_hz: z.array(z.number()),
  group_delay_ms: z.array(z.number()),
}).passthrough();

export type GroupDelayData = z.infer<typeof GroupDelaySchema>;

// Distortion data schema
export const DistortionSchema = z.object({
  frequencies_hz: z.array(z.number()),
  thd_percent: z.array(z.number()),
  harmonics: z.record(z.array(z.number())).optional(),
}).passthrough();

export type DistortionData = z.infer<typeof DistortionSchema>;

// Impulse response data schema
export const ImpulseResponseSchema = z.object({
  samples: z.array(z.number()),
  sample_rate_hz: z.number(),
  peak_index: z.number().optional(),
  start_time_s: z.number().optional(),
  duration_s: z.number().optional()
}).passthrough();

export type ImpulseResponseData = z.infer<typeof ImpulseResponseSchema>;

// Waterfall data schema
export const WaterfallSchema = z.object({
  frequencies_hz: z.array(z.number()),
  time_slices_ms: z.array(z.number()),
  magnitude_db: z.array(z.array(z.number()))
}).passthrough();

export type WaterfallData = z.infer<typeof WaterfallSchema>;

// RT60 data schema
export const RT60Schema = z.object({
  frequencies_hz: z.array(z.number()),
  t20_seconds: z.array(z.number()),
  t30_seconds: z.array(z.number()),
  edt_seconds: z.array(z.number()),
  topt_seconds: z.array(z.number()).optional()
}).passthrough();

export type RT60Data = z.infer<typeof RT60Schema>;

// Frequency response data schema
export const FrequencyResponseSchema = z.object({
  frequencies_hz: z.array(z.number()),
  spl_db: z.array(z.number()),
  phase_degrees: z.array(z.number()).optional()
}).passthrough();

export type FrequencyResponseData = z.infer<typeof FrequencyResponseSchema>;

// Validation helper with error transformation
export function validateApiResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`API validation failed (${context}): ${issues}`);
  }
  return result.data;
}
