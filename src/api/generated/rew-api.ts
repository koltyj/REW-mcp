/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface Command {
  command?: string;
  parameters?: string[];
}

export interface APIResponse {
  message?: string;
  validValues?: string[];
}

export interface ErrorMessage {
  time?: string;
  title?: string;
  message?: string;
  details?: string;
}

export interface Subscriber {
  url?: string;
  parameters?: object;
}

export interface WarningMessage {
  time?: string;
  title?: string;
  message?: string;
}

export interface ImageCaptureSettings {
  /** @format int32 */
  imageWidth?: number;
  /** @format int32 */
  graphTextSize?: number;
  /** @format int32 */
  commentTextSize?: number;
  /** @format int32 */
  traceThickness?: number;
  useDarkScheme?: boolean;
  /** @format int32 */
  iec263Ratio?: number;
  includeLegend?: boolean;
  includeTitle?: boolean;
  includeCursor?: boolean;
  includeTimestamp?: boolean;
  includeBorder?: boolean;
  monochrome?: boolean;
  scaleOverlays?: boolean;
  asPNG?: boolean;
  comment?: string;
  commentAlignment?: string;
  commentPosition?: string;
}

export interface GraphLimits {
  /** @format double */
  left?: number;
  /** @format double */
  right?: number;
  /** @format double */
  top?: number;
  /** @format double */
  bottom?: number;
  /** @format double */
  top2?: number;
  /** @format double */
  bottom2?: number;
}

export interface AudioStatus {
  enabled?: boolean;
  ready?: boolean;
}

export interface AudioConfiguration {
  treat32Bitas24Bit?: boolean;
}

export interface Driver {
  driver?: string;
}

export interface InputCalConfiguration {
  currentInputSelection?: string;
  separateCalFileForEachInput?: boolean;
  inputDeviceIsCWeighted?: boolean;
  calDataAllInputs?: InputCalData;
  perInputCalData?: object;
}

export interface InputCalData {
  calFilePath?: string;
  /** @format double */
  dBFSAt94dBSPL?: number;
  /** @format double */
  fullScaleSineVrms?: number;
}

export interface Value {
  /** @format double */
  value?: number;
  unit?: string;
}

export interface OutputCalConfiguration {
  currentOutputSelection?: string;
  calData?: OutputCalData;
}

export interface OutputCalData {
  calFilePath?: string;
  sampleRate?: Value;
}

export interface InputOptions {
  invert?: boolean;
  highPass?: boolean;
  virtualBalanced?: boolean;
  virtualBalancedMode?: string;
  multipleInputs?: boolean;
}

export interface OutputOptions {
  invertSecond?: boolean;
}

export interface InputBitMask {
  mask?: string;
  /** @format int32 */
  activeBits?: number;
}

export interface Device {
  device?: string;
}

export interface Input {
  input?: string;
}

export interface Output {
  output?: string;
}

export interface Enable {
  enable?: boolean;
}

export interface ASIOFormat {
  inputFormat?: string;
  outputFormat?: string;
  /** @format int32 */
  bufferSamples?: number;
}

export interface JavaFormat {
  /** @format int32 */
  inputBits?: number;
  /** @format int32 */
  outputBits?: number;
}

export interface OutputChannelMapping {
  /** @format int32 */
  index?: number;
  /** @format int32 */
  hardwareChannel?: number;
  channelLabel?: string;
}

export interface OutputChannelMappingList {
  mapping?: OutputChannelMapping[];
}

export interface InputChannel {
  /** @format int32 */
  channel?: number;
}

export interface OutputChannel {
  channel?: string;
}

export interface InputLevels {
  unit?: string;
  rms?: number[];
  peak?: number[];
  /** @format double */
  timeSpanSeconds?: number;
}

export interface GeneratorStatus {
  enabled?: boolean;
  playing?: boolean;
  signal?: string;
  /** @format double */
  level?: number;
  levelUnit?: string;
}

export interface Protections {
  splLimitAbort?: boolean;
  clippingAbort?: boolean;
  /** @format int32 */
  dBSPLLimit?: number;
  warnForLowLevels?: boolean;
  warnForHighDistortion?: boolean;
  warnForLowSNR?: boolean;
}

export interface Signal {
  signal?: string;
}

export type Object = object;

export type Map = object;

export interface FsafNoiseConfiguration {
  type?: string;
}

export interface RandomNoiseConfiguration {
  type?: string;
  /** @format double */
  octaveCentre?: number;
  /** @format double */
  thirdOctaveCentre?: number;
  customLowCut?: boolean;
  /** @format int32 */
  customLowCutFreq?: number;
  customHighCut?: boolean;
  /** @format int32 */
  customHighCutFreq?: number;
  /** @format int32 */
  customFilterOrder?: number;
  gaussian?: boolean;
}

export interface PeriodicNoiseConfiguration {
  type?: string;
  /** @format double */
  octaveCentre?: number;
  /** @format double */
  thirdOctaveCentre?: number;
  customLowCut?: boolean;
  /** @format int32 */
  customLowCutFreq?: number;
  customHighCut?: boolean;
  /** @format int32 */
  customHighCutFreq?: number;
  /** @format int32 */
  customFilterOrder?: number;
  minimiseCrestFactor?: boolean;
  sequenceLength?: string;
}

export interface SineConfiguration {
  /** @format double */
  frequency?: number;
  lockFrequencyToRTAFFT?: boolean;
  addHarmonicDistortion?: boolean;
  addDither?: boolean;
  /** @format int32 */
  ditherBits?: number;
}

export interface SineDistortion {
  addH2?: boolean;
  /** @format double */
  dBH2?: number;
  /** @format double */
  degreesH2?: number;
  addH3?: boolean;
  /** @format double */
  dBH3?: number;
  /** @format double */
  degreesH3?: number;
  addH4?: boolean;
  /** @format double */
  dBH4?: number;
  /** @format double */
  degreesH4?: number;
  addH5?: boolean;
  /** @format double */
  dBH5?: number;
  /** @format double */
  degreesH5?: number;
  addH6?: boolean;
  /** @format double */
  dBH6?: number;
  /** @format double */
  degreesH6?: number;
  addH7?: boolean;
  /** @format double */
  dBH7?: number;
  /** @format double */
  degreesH7?: number;
  addH8?: boolean;
  /** @format double */
  dBH8?: number;
  /** @format double */
  degreesH8?: number;
  addH9?: boolean;
  /** @format double */
  dBH9?: number;
  /** @format double */
  degreesH9?: number;
}

export interface SquareConfiguration {
  /** @format double */
  frequency?: number;
  /** @format int32 */
  dutyCyclePercent?: number;
  bandLimit?: boolean;
  addDither?: boolean;
  /** @format int32 */
  ditherBits?: number;
}

export interface SawtoothConfiguration {
  /** @format double */
  frequency?: number;
  bandLimit?: boolean;
  invert?: boolean;
  addDither?: boolean;
  /** @format int32 */
  ditherBits?: number;
}

export interface ToneBurstConfiguration {
  /** @format double */
  frequency?: number;
  window?: string;
  /** @format double */
  windowWidth?: number;
  windowWidthUnit?: string;
  /** @format int32 */
  period?: number;
  periodUnit?: string;
  repeat?: boolean;
}

export interface CEABurstConfiguration {
  /** @format double */
  frequency?: number;
  repeat?: boolean;
}

export interface TwoToneConfiguration {
  type?: string;
  /** @format int32 */
  customF1?: number;
  /** @format int32 */
  customF2?: number;
  /** @format int32 */
  customRatio?: number;
  addDither?: boolean;
  /** @format int32 */
  ditherBits?: number;
}

export interface ThreeToneConfiguration {
  type?: string;
  /** @format int32 */
  customF1?: number;
  /** @format int32 */
  customF2?: number;
  /** @format int32 */
  customF3?: number;
  addDither?: boolean;
  /** @format int32 */
  ditherBits?: number;
}

export interface MultitoneConfiguration {
  /** @format int32 */
  startFreq?: number;
  /** @format int32 */
  endFreq?: number;
  sequenceLength?: string;
  spectrum?: string;
  spacing?: string;
  /** @format int32 */
  linearSpacingHz?: number;
  octaveSpacing?: string;
  decadeSpacing?: string;
  minimiseCrestFactor?: boolean;
  addDither?: boolean;
  /** @format int32 */
  ditherBits?: number;
}

export interface MultitoneDetails {
  /** @format double */
  firstFreq?: number;
  /** @format double */
  lastFreq?: number;
  /** @format int32 */
  numTones?: number;
  /** @format double */
  crestFactordB?: number;
  /** @format double */
  kurtosis?: number;
}

export interface LinearSweepConfiguration {
  /** @format int32 */
  startFrequency?: number;
  /** @format int32 */
  endFrequency?: number;
  /** @format int32 */
  fadeInMilliseconds?: number;
  /** @format int32 */
  fadeOutMilliseconds?: number;
  /** @format double */
  durationSeconds?: number;
  loop?: boolean;
}

export interface LogSweepConfiguration {
  /** @format int32 */
  startFrequency?: number;
  /** @format int32 */
  endFrequency?: number;
  fadeInFraction?: string;
  fadeOutFraction?: string;
  /** @format double */
  durationSeconds?: number;
  loop?: boolean;
}

export interface MeasSweepConfiguration {
  /** @format int32 */
  startFrequency?: number;
  /** @format int32 */
  endFrequency?: number;
  length?: string;
  fillSilenceWithDither?: boolean;
}

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
  /** @format int32 */
  rollingLeqMinutes?: number;
}

export interface SPLValues {
  /** @format int32 */
  meterNumber?: number;
  splWeighting?: string;
  leqWeighting?: string;
  selWeighting?: string;
  filter?: string;
  /** @format double */
  spl?: number;
  /** @format double */
  leq?: number;
  isRollingLeq?: boolean;
  /** @format double */
  rollingLeqMinutes?: number;
  /** @format double */
  leq1m?: number;
  /** @format double */
  leq10m?: number;
  /** @format double */
  sel?: number;
  /** @format double */
  lcPeak?: number;
  /** @format double */
  lzPeak?: number;
  /** @format double */
  elapsedTime?: number;
}

export interface SPLLoggerConfiguration {
  showTimesAsTimeOfDay?: boolean;
  logToFileUsingDateAsFilename?: boolean;
}

export interface MeasurementSummary {
  title?: string;
  notes?: string;
  date?: string;
  uuid?: string;
  groupName?: string;
  groupNotes?: string;
  groupID?: string;
  /** @format float */
  startFreq?: number;
  /** @format float */
  endFreq?: number;
  inverted?: boolean;
  /** @format double */
  sampleRate?: number;
  rewVersion?: string;
  timingReference?: string;
  /** @format double */
  delay?: number;
  /** @format double */
  timingOffset?: number;
  /** @format double */
  signalToNoisedB?: number;
  /** @format double */
  splOffsetdB?: number;
  /** @format double */
  alignSPLOffsetdB?: number;
  /** @format double */
  cumulativeIRShiftSeconds?: number;
  /** @format double */
  clockAdjustmentPPM?: number;
  /** @format double */
  timeOfIRStartSeconds?: number;
  /** @format double */
  timeOfIRPeakSeconds?: number;
}

export interface ProcessResult {
  processName?: string;
  message?: string;
  results?: object;
}

export interface ProcessMeasurements {
  processName?: string;
  measurementIndices?: number[];
  measurementUUIDs?: string[];
  parameters?: object;
  resultUrl?: string;
}

export interface ProcessSingleMeasurement {
  command?: string;
  parameters?: object;
  resultUrl?: string;
}

export interface IRWindows {
  leftWindowType?: string;
  rightWindowType?: string;
  /** @format double */
  leftWindowWidthms?: number;
  /** @format double */
  rightWindowWidthms?: number;
  /** @format double */
  refTimems?: number;
  addFDW?: boolean;
  /** @format double */
  fdwWidthCycles?: number;
  /** @format double */
  fdwWidthOctaves?: number;
  addMTW?: boolean;
  mtwTimesms?: number[];
}

export interface EqualiserEntry {
  manufacturer?: string;
  model?: string;
}

export interface TargetSettings {
  shape?: string;
  /** @format int32 */
  bassManagementSlopedBPerOctave?: number;
  /** @format int32 */
  bassManagementCutoffHz?: number;
  /** @format int32 */
  lowFreqSlopedBPerOctave?: number;
  /** @format int32 */
  lowFreqCutoffHz?: number;
  lowPassCrossoverType?: string;
  highPassCrossoverType?: string;
  /** @format int32 */
  lowPassCutoffHz?: number;
  /** @format int32 */
  highPassCutoffHz?: number;
}

export interface RoomCurveSettings {
  addRoomCurve?: boolean;
  /** @format int32 */
  lowFreqRiseStartHz?: number;
  /** @format int32 */
  lowFreqRiseEndHz?: number;
  /** @format double */
  lowFreqRiseSlopedBPerOctave?: number;
  /** @format int32 */
  highFreqFallStartHz?: number;
  /** @format double */
  highFreqFallSlopedBPerOctave?: number;
}

export interface FilterSetting {
  /** @format int32 */
  index?: number;
  type?: string;
  enabled?: boolean;
  isAuto?: boolean;
  /** @format double */
  frequency?: number;
  /** @format double */
  gaindB?: number;
  /** @format double */
  q?: number;
  /** @format double */
  t60Target?: number;
  /** @format double */
  frequency2?: number;
  /** @format double */
  q2?: number;
  shape?: string;
  /** @format int32 */
  slopedBPerOctave?: number;
  /** @format int32 */
  slope2dBPerOctave?: number;
}

export interface FilterList {
  filters?: FilterSetting[];
}

export interface FrequencyResponse {
  message?: string;
  unit?: string;
  /** @format int64 */
  nanotime?: number;
  /** @format int64 */
  totalSamplesProcessed?: number;
  smoothing?: string;
  /** @format double */
  startFreq?: number;
  /** @format int32 */
  ppo?: number;
  /** @format double */
  freqStep?: number;
  magnitude?: string;
  phase?: string;
}

export interface ImpulseResponse {
  message?: string;
  unit?: string;
  /** @format double */
  startTime?: number;
  /** @format double */
  sampleInterval?: number;
  /** @format double */
  sampleRate?: number;
  timingReference?: string;
  /** @format double */
  timingRefTime?: number;
  /** @format double */
  timingOffset?: number;
  /** @format double */
  delay?: number;
  data?: string;
}

export interface RT60Settings {
  /** @format int32 */
  filterOrder?: number;
  zeroPhaseFiltered?: boolean;
  reverseFiltered?: boolean;
}

export interface RT60Result {
  /** @format double */
  fc?: number;
  /** @format int32 */
  octaveFrac?: number;
  /** @format double */
  EDT?: number;
  edtUnit?: string;
  /** @format double */
  T20?: number;
  t20Unit?: string;
  /** @format double */
  T30?: number;
  t30Unit?: string;
  /** @format double */
  Topt?: number;
  toptUnit?: string;
  /** @format double */
  T60M?: number;
  t60mUnit?: string;
  /** @format double */
  C50?: number;
  c50Unit?: string;
  /** @format double */
  C80?: number;
  c80Unit?: string;
  /** @format double */
  Cxx?: number;
  cXXUnit?: string;
  /** @format int32 */
  CxxTimems?: number;
  /** @format double */
  D50?: number;
  d50Unit?: string;
  /** @format double */
  TS?: number;
  tsUnit?: string;
}

export interface Distortion {
  measurement?: string;
  type?: string;
  columnHeaders?: string[];
  data?: number[];
}

export interface MeasurementNaming {
  title?: string;
  namingOption?: string;
  /** @format int32 */
  nextNumber?: number;
  /** @format int32 */
  numberIncrement?: number;
  dateTimeFormat?: string;
  prefixMeasNameWithOutput?: boolean;
  appendLevelToMeasName?: boolean;
}

export interface ChannelList {
  channels?: string[];
}

export interface RTAStatus {
  enabled?: boolean;
  running?: boolean;
}

export interface RTAConfiguration {
  mode?: string;
  smoothing?: string;
  fftLength?: string;
  window?: string;
  averaging?: string;
  stopAt?: boolean;
  /** @format int32 */
  stopAtValue?: number;
  maximumOverlap?: string;
  calcDistortionEnabled?: boolean;
  restartCaptureOnGeneratorChange?: boolean;
  stopGeneratorWithRTA?: boolean;
  use64BitFFT?: boolean;
  adjustRTALevels?: boolean;
  fundamentalFromSineGen?: boolean;
}

export interface RTADistortionConfiguration {
  /** @format int32 */
  lowPass?: number;
  /** @format int32 */
  highPass?: number;
  enableLowPass?: boolean;
  enableHighPass?: boolean;
  useManualFundamental?: boolean;
  /** @format double */
  manualFundamentalVrms?: number;
  useAES17StandardNotch?: boolean;
  showHarmonicPhase?: boolean;
  highlightFundamental?: boolean;
  distortionUnit?: string;
  useCoherentAveraging?: boolean;
  useCrossCorrelationAveraging?: boolean;
  monitorClockRateMatch?: boolean;
  showNoteName?: boolean;
}

export interface RTAAppearanceConfiguration {
  /** @format int32 */
  updateInterval?: number;
  /** @format int32 */
  peakHoldSeconds?: number;
  /** @format int32 */
  peakDecaydBPerSecond?: number;
  showNoiseCurves?: boolean;
  noiseCurveType?: string;
  /** @format double */
  dBWRefResistance?: number;
  ceaMaxSPLLimitType?: string;
  useBarsOnSpectrum?: boolean;
  useBarsOnRTA?: boolean;
  showPeakSPLForToneBursts?: boolean;
  showHearingThreshold?: boolean;
}

export interface RTALevel {
  message?: string;
  /** @format int64 */
  nanotime?: number;
  /** @format int64 */
  totalSamplesProcessed?: number;
  rmsLevel?: Value;
  rmsLevelAWeighted?: Value;
  rmsLevelCWeighted?: Value;
  rmsLevelInBand?: Value;
  rmsLevelOutOfBand?: Value;
  peakLevel?: Value;
  /** @format int32 */
  PNC?: number;
  /** @format int32 */
  NCB?: number;
  /** @format int32 */
  NC?: number;
  /** @format int32 */
  NR?: number;
}

export interface RTADistortion {
  message?: string;
  /** @format int64 */
  nanotime?: number;
  /** @format int64 */
  totalSamplesProcessed?: number;
  /** @format double */
  fundamentalFrequency?: number;
  /** @format double */
  fundamentaldBFS?: number;
  fundamentalLevel?: Value;
  /** @format double */
  gaindB?: number;
  /** @format int32 */
  distortionLPHz?: number;
  /** @format int32 */
  distortionHPHz?: number;
  thd?: Value;
  thdPlusN?: Value;
  /** @format double */
  nAndNHD?: number;
  /** @format double */
  enob?: number;
  higherHarmonicDistortion?: Value;
  /** @format int32 */
  firstHigherHarmonic?: number;
  /** @format int32 */
  lastHigherHarmonic?: number;
  /** @format double */
  dBFSAWeightedNandD?: number;
  /** @format double */
  rmsNandNHDdBFS?: number;
  /** @format int32 */
  thdHarmonics?: number;
  /** @format int32 */
  averages?: number;
  coherentAveraging?: boolean;
  crossCorrAveraging?: boolean;
  harmonics?: Value[];
  harmonicPhasesDegrees?: number[];
  higherHarmonics?: Value[];
  imdDescription?: string;
  imd?: Value;
  DFD2?: Value;
  DFD3?: Value;
  MD2?: Value;
  MD3?: Value;
  d2L?: Value;
  d2H?: Value;
  d3L?: Value;
  d3H?: Value;
  d4L?: Value;
  d4H?: Value;
  d5L?: Value;
  d5H?: Value;
  imdReference?: string;
  /** @format double */
  imdRef?: number;
  /** @format double */
  imdPowerPercent?: number;
  /** @format double */
  imdF1?: number;
  /** @format double */
  imdF2?: number;
  /** @format double */
  imdF3?: number;
  /** @format double */
  d2Percent?: number;
  /** @format double */
  d3Percent?: number;
  tdPlusN?: Value;
  /** @format double */
  tdPlusNRef?: number;
  /** @format double */
  snrdB?: number;
  /** @format double */
  clockPPM?: number;
  /** @format double */
  clockDeltaPPM?: number;
  clockDeltaPPMStable?: boolean;
}

export interface CommandWithMap {
  command?: string;
  parameters?: object;
}

export interface SteppedFreqSpan {
  /** @format double */
  startFreq?: number;
  /** @format double */
  endFreq?: number;
  /** @format int32 */
  ppo?: number;
}

export interface SteppedLevelSpan {
  /** @format double */
  startLevel?: number;
  /** @format double */
  endLevel?: number;
  /** @format double */
  step?: number;
}

export interface SteppedFFTConfiguration {
  fftLength?: string;
  /** @format int32 */
  averages?: number;
  maximumOverlap?: string;
  window?: string;
}

export interface SteppedOptions {
  /** @format int32 */
  silenceIntervalSeconds?: number;
  captureSpectrum?: boolean;
  stopForHeavyClipping?: boolean;
  stopAtDistortionLimit?: boolean;
  /** @format double */
  distortionLimitPercent?: number;
  reduceStepIfDistortionLimitHit?: boolean;
}

export interface SteppedProgress {
  /** @format int32 */
  point?: number;
  /** @format int32 */
  points?: number;
  message?: string;
  /** @format int32 */
  timeRemainingSeconds?: number;
}

export interface MatchTargetSettings {
  /** @format int32 */
  startFrequency?: number;
  /** @format int32 */
  endFrequency?: number;
  /** @format int32 */
  individualMaxBoostdB?: number;
  /** @format int32 */
  overallMaxBoostdB?: number;
  /** @format int32 */
  flatnessTargetdB?: number;
  allowNarrowFiltersBelow200Hz?: boolean;
  varyQAbove200Hz?: boolean;
  allowLowShelf?: boolean;
  /** @format int32 */
  lowShelfMin?: number;
  /** @format int32 */
  lowShelfMax?: number;
  allowHighShelf?: boolean;
  /** @format int32 */
  highShelfMin?: number;
  /** @format int32 */
  highShelfMax?: number;
}

export interface AlignmentCommand {
  command?: string;
  /** @format double */
  frequency?: number;
  resultUrl?: string;
}

export interface FilePath {
  path?: string;
  channels?: string;
  applyCal?: boolean;
}

export interface FrequencyResponseData {
  identifier?: string;
  isImpedance?: boolean;
  /** @format double */
  startFreq?: number;
  /** @format int32 */
  ppo?: number;
  /** @format double */
  freqStep?: number;
  magnitude?: string;
  phase?: string;
}

export interface ImpulseResponseData {
  identifier?: string;
  /** @format double */
  startTime?: number;
  /** @format double */
  sampleRate?: number;
  /** @format double */
  splOffset?: number;
  applyCal?: boolean;
  data?: string;
}

export interface RTAFilePath {
  path?: string;
  /** @format int32 */
  channel?: number;
  saveOption?: string;
}

export interface RoomDimensions {
  unit?: string;
  /** @format double */
  length?: number;
  /** @format double */
  width?: number;
  /** @format double */
  height?: number;
}

export interface Absorptions {
  /** @format double */
  front?: number;
  /** @format double */
  back?: number;
  /** @format double */
  left?: number;
  /** @format double */
  right?: number;
  /** @format double */
  ceiling?: number;
  /** @format double */
  floor?: number;
}

export interface RoomSimOptions {
  showAnechoicResponses?: boolean;
  timeAlignSpeakersAndSubs?: boolean;
  alignSubsIndividually?: boolean;
  useCrossoverFilter?: boolean;
  /** @format int32 */
  crossoverFrequencyHz?: number;
  subsHaveSameDelay?: boolean;
  /** @format int32 */
  subsDelayms?: number;
}

export interface RoomPosition {
  unit?: string;
  /** @format double */
  fromRear?: number;
  /** @format double */
  fromLeft?: number;
  /** @format double */
  fromFloor?: number;
}

export interface MicPositionOffsets {
  unit?: string;
  /** @format double */
  inFront?: number;
  /** @format double */
  behind?: number;
  /** @format double */
  left?: number;
  /** @format double */
  right?: number;
  /** @format double */
  above?: number;
  /** @format double */
  below?: number;
}

export interface RoomSimSources {
  sources?: string[];
}

export interface SourceConfiguration {
  /** @format int32 */
  lfMinus3dBHz?: number;
  enclosureType?: string;
  invert?: boolean;
  /** @format int32 */
  delayms?: number;
  /** @format int32 */
  gaindB?: number;
}

export interface GroupInfo {
  name?: string;
  notes?: string;
  uuid?: string;
}
