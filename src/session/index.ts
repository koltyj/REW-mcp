/**
 * Session management module for REW MCP server.
 *
 * Provides session state management and measurement sequence enforcement.
 */

export {
  SessionState,
  SessionMeasurement,
  createSession,
  getSession,
  updateSession,
  listActiveSessions,
  endSession,
} from './session-state.js';

export {
  SequenceStep,
  validTransitions,
  validateTransition,
  getNextStep,
  getStepGuidance,
  channelToStep,
} from './sequence-state-machine.js';
