/**
 * Zod schemas for REW API response validation
 *
 * These schemas provide runtime validation and type inference
 * for data received from the REW API.
 */
import { z } from 'zod';
export declare const InputCalibrationSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    gain_db: z.ZodOptional<z.ZodNumber>;
    offset_db: z.ZodOptional<z.ZodNumber>;
    calibration_file: z.ZodOptional<z.ZodString>;
    sensitivity_db: z.ZodOptional<z.ZodNumber>;
    calDataAllInputs: z.ZodOptional<z.ZodObject<{
        calFilePath: z.ZodOptional<z.ZodString>;
        dBFSAt94dBSPL: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        calFilePath?: string | undefined;
        dBFSAt94dBSPL?: number | undefined;
    }, {
        calFilePath?: string | undefined;
        dBFSAt94dBSPL?: number | undefined;
    }>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    gain_db: z.ZodOptional<z.ZodNumber>;
    offset_db: z.ZodOptional<z.ZodNumber>;
    calibration_file: z.ZodOptional<z.ZodString>;
    sensitivity_db: z.ZodOptional<z.ZodNumber>;
    calDataAllInputs: z.ZodOptional<z.ZodObject<{
        calFilePath: z.ZodOptional<z.ZodString>;
        dBFSAt94dBSPL: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        calFilePath?: string | undefined;
        dBFSAt94dBSPL?: number | undefined;
    }, {
        calFilePath?: string | undefined;
        dBFSAt94dBSPL?: number | undefined;
    }>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    gain_db: z.ZodOptional<z.ZodNumber>;
    offset_db: z.ZodOptional<z.ZodNumber>;
    calibration_file: z.ZodOptional<z.ZodString>;
    sensitivity_db: z.ZodOptional<z.ZodNumber>;
    calDataAllInputs: z.ZodOptional<z.ZodObject<{
        calFilePath: z.ZodOptional<z.ZodString>;
        dBFSAt94dBSPL: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        calFilePath?: string | undefined;
        dBFSAt94dBSPL?: number | undefined;
    }, {
        calFilePath?: string | undefined;
        dBFSAt94dBSPL?: number | undefined;
    }>>;
}, z.ZodTypeAny, "passthrough">>;
export type InputCalibration = z.infer<typeof InputCalibrationSchema>;
export declare const REWApiResponseSchema: z.ZodObject<{
    status: z.ZodNumber;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: number;
    error?: string | undefined;
    data?: unknown;
}, {
    status: number;
    error?: string | undefined;
    data?: unknown;
}>;
export type REWApiResponse = z.infer<typeof REWApiResponseSchema>;
export declare const MeasurementInfoSchema: z.ZodObject<{
    uuid: z.ZodString;
    name: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodString>;
    has_ir: z.ZodOptional<z.ZodBoolean>;
    has_fr: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    hasImpulse: z.ZodOptional<z.ZodBoolean>;
    hasFrequencyResponse: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    uuid: z.ZodString;
    name: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodString>;
    has_ir: z.ZodOptional<z.ZodBoolean>;
    has_fr: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    hasImpulse: z.ZodOptional<z.ZodBoolean>;
    hasFrequencyResponse: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    uuid: z.ZodString;
    name: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodString>;
    has_ir: z.ZodOptional<z.ZodBoolean>;
    has_fr: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    hasImpulse: z.ZodOptional<z.ZodBoolean>;
    hasFrequencyResponse: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export type MeasurementInfo = z.infer<typeof MeasurementInfoSchema>;
export declare const MeasurementArraySchema: z.ZodArray<z.ZodObject<{
    uuid: z.ZodString;
    name: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodString>;
    has_ir: z.ZodOptional<z.ZodBoolean>;
    has_fr: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    hasImpulse: z.ZodOptional<z.ZodBoolean>;
    hasFrequencyResponse: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    uuid: z.ZodString;
    name: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodString>;
    has_ir: z.ZodOptional<z.ZodBoolean>;
    has_fr: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    hasImpulse: z.ZodOptional<z.ZodBoolean>;
    hasFrequencyResponse: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    uuid: z.ZodString;
    name: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodString>;
    has_ir: z.ZodOptional<z.ZodBoolean>;
    has_fr: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
    hasImpulse: z.ZodOptional<z.ZodBoolean>;
    hasFrequencyResponse: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>, "many">;
export declare const SweepConfigSchema: z.ZodObject<{
    startFreq: z.ZodOptional<z.ZodNumber>;
    endFreq: z.ZodOptional<z.ZodNumber>;
    level: z.ZodOptional<z.ZodNumber>;
    length: z.ZodOptional<z.ZodNumber>;
    sweepType: z.ZodOptional<z.ZodString>;
    timing: z.ZodOptional<z.ZodString>;
    fillSilenceWithDither: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    startFreq: z.ZodOptional<z.ZodNumber>;
    endFreq: z.ZodOptional<z.ZodNumber>;
    level: z.ZodOptional<z.ZodNumber>;
    length: z.ZodOptional<z.ZodNumber>;
    sweepType: z.ZodOptional<z.ZodString>;
    timing: z.ZodOptional<z.ZodString>;
    fillSilenceWithDither: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    startFreq: z.ZodOptional<z.ZodNumber>;
    endFreq: z.ZodOptional<z.ZodNumber>;
    level: z.ZodOptional<z.ZodNumber>;
    length: z.ZodOptional<z.ZodNumber>;
    sweepType: z.ZodOptional<z.ZodString>;
    timing: z.ZodOptional<z.ZodString>;
    fillSilenceWithDither: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export type SweepConfig = z.infer<typeof SweepConfigSchema>;
export declare const MeasureLevelSchema: z.ZodObject<{
    level: z.ZodOptional<z.ZodNumber>;
    value: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    level: z.ZodOptional<z.ZodNumber>;
    value: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    level: z.ZodOptional<z.ZodNumber>;
    value: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export type MeasureLevel = z.infer<typeof MeasureLevelSchema>;
export declare const InputLevelsSchema: z.ZodObject<{
    unit: z.ZodString;
    rms: z.ZodArray<z.ZodNumber, "many">;
    peak: z.ZodArray<z.ZodNumber, "many">;
    timeSpanSeconds: z.ZodNumber;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    unit: z.ZodString;
    rms: z.ZodArray<z.ZodNumber, "many">;
    peak: z.ZodArray<z.ZodNumber, "many">;
    timeSpanSeconds: z.ZodNumber;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    unit: z.ZodString;
    rms: z.ZodArray<z.ZodNumber, "many">;
    peak: z.ZodArray<z.ZodNumber, "many">;
    timeSpanSeconds: z.ZodNumber;
}, z.ZodTypeAny, "passthrough">>;
export type InputLevelsResponse = z.infer<typeof InputLevelsSchema>;
export interface InputLevels {
    unit: string;
    rms_levels: number[];
    peak_levels: number[];
    time_span_seconds: number;
}
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
    getInputLevelCommands(): Promise<string[]>;
    startInputLevelMonitoring(): Promise<boolean>;
    stopInputLevelMonitoring(): Promise<boolean>;
    getInputLevelUnits(): Promise<string[]>;
    getInputLevels(unit?: string): Promise<InputLevels | null>;
}
export declare const ImpulseResponseSchema: z.ZodObject<{
    samples: z.ZodArray<z.ZodNumber, "many">;
    sample_rate_hz: z.ZodNumber;
    peak_index: z.ZodOptional<z.ZodNumber>;
    start_time_s: z.ZodOptional<z.ZodNumber>;
    duration_s: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    samples: z.ZodArray<z.ZodNumber, "many">;
    sample_rate_hz: z.ZodNumber;
    peak_index: z.ZodOptional<z.ZodNumber>;
    start_time_s: z.ZodOptional<z.ZodNumber>;
    duration_s: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    samples: z.ZodArray<z.ZodNumber, "many">;
    sample_rate_hz: z.ZodNumber;
    peak_index: z.ZodOptional<z.ZodNumber>;
    start_time_s: z.ZodOptional<z.ZodNumber>;
    duration_s: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
export type ImpulseResponseData = z.infer<typeof ImpulseResponseSchema>;
export declare const WaterfallSchema: z.ZodObject<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    time_slices_ms: z.ZodArray<z.ZodNumber, "many">;
    magnitude_db: z.ZodArray<z.ZodArray<z.ZodNumber, "many">, "many">;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    time_slices_ms: z.ZodArray<z.ZodNumber, "many">;
    magnitude_db: z.ZodArray<z.ZodArray<z.ZodNumber, "many">, "many">;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    time_slices_ms: z.ZodArray<z.ZodNumber, "many">;
    magnitude_db: z.ZodArray<z.ZodArray<z.ZodNumber, "many">, "many">;
}, z.ZodTypeAny, "passthrough">>;
export type WaterfallData = z.infer<typeof WaterfallSchema>;
export declare const RT60Schema: z.ZodObject<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    t20_seconds: z.ZodArray<z.ZodNumber, "many">;
    t30_seconds: z.ZodArray<z.ZodNumber, "many">;
    edt_seconds: z.ZodArray<z.ZodNumber, "many">;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    t20_seconds: z.ZodArray<z.ZodNumber, "many">;
    t30_seconds: z.ZodArray<z.ZodNumber, "many">;
    edt_seconds: z.ZodArray<z.ZodNumber, "many">;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    t20_seconds: z.ZodArray<z.ZodNumber, "many">;
    t30_seconds: z.ZodArray<z.ZodNumber, "many">;
    edt_seconds: z.ZodArray<z.ZodNumber, "many">;
}, z.ZodTypeAny, "passthrough">>;
export type RT60Data = z.infer<typeof RT60Schema>;
export declare const FrequencyResponseSchema: z.ZodObject<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    spl_db: z.ZodArray<z.ZodNumber, "many">;
    phase_degrees: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    spl_db: z.ZodArray<z.ZodNumber, "many">;
    phase_degrees: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    frequencies_hz: z.ZodArray<z.ZodNumber, "many">;
    spl_db: z.ZodArray<z.ZodNumber, "many">;
    phase_degrees: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, z.ZodTypeAny, "passthrough">>;
export type FrequencyResponseData = z.infer<typeof FrequencyResponseSchema>;
export declare function validateApiResponse<T>(schema: z.ZodType<T>, data: unknown, context: string): T;
//# sourceMappingURL=schemas.d.ts.map