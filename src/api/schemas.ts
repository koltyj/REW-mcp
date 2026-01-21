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
  name: z.string(),
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

// Measure level schema
export const MeasureLevelSchema = z.object({
  level: z.number().optional(),
  value: z.number().optional(),
  unit: z.string().optional()
}).passthrough();

export type MeasureLevel = z.infer<typeof MeasureLevelSchema>;

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
  getMeasureLevel(): Promise<unknown>;
  setMeasureLevel(level: number, unit?: string): Promise<boolean>;
  getSweepConfig(): Promise<unknown>;
  setSweepConfig(config: unknown): Promise<boolean>;
  setMeasureNotes(notes: string): Promise<boolean>;
  getMeasureCommands(): Promise<string[]>;
  executeMeasureCommand(command: string, parameters?: string[]): Promise<unknown>;
  setGeneratorSignal(signal: string): Promise<boolean>;
  setGeneratorLevel(level: number, unit?: string): Promise<boolean>;
  executeGeneratorCommand(command: string): Promise<boolean>;
  getSPLMeterLevels(meterId: number): Promise<unknown>;
}

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
  edt_seconds: z.array(z.number())
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
