/**
 * Events module — typed event bus for the REW MCP TUI layer.
 */

export { tuiEventBus, resetEventBus } from './bus.js';

export type {
  TuiEvent,
  TuiEventMap,
  TuiEventType,
  AssessmentVerdict,
  Confidence,
  Severity,
  Zone,
  WorkflowSessionStartedPayload,
  WorkflowStepChangedPayload,
  WorkflowSessionCompletedPayload,
  WorkflowDeviceStatusPayload,
  WorkflowMeasurementIngestedPayload,
  HealthRewConnectedPayload,
  HealthHeartbeatPayload,
  HealthApiErrorPayload,
  AnalysisRoomCompletePayload,
  AnalysisDecayCompletePayload,
  AnalysisComparisonCompletePayload,
  CalibrationSPLReadingPayload,
  CalibrationGeneratorStatePayload,
  OptimizationRecommendationPayload,
  OptimizationValidatedPayload,
  OptimizationProgressPayload,
} from './types.js';
