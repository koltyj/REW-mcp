/**
 * WorkflowPane component — left pane.
 *
 * Shows session info, step progress visualization, guidance text,
 * and calibration status (SPL + generator).
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { SequenceStep } from '../../session/index.js';
import type {
  WorkflowSessionStartedPayload,
  WorkflowStepChangedPayload,
  WorkflowSessionCompletedPayload,
  CalibrationSPLReadingPayload,
  CalibrationGeneratorStatePayload,
} from '../../events/types.js';

export interface WorkflowPaneProps {
  session: WorkflowSessionStartedPayload | null;
  currentStep: WorkflowStepChangedPayload | null;
  sessionCompleted: WorkflowSessionCompletedPayload | null;
  splReading: CalibrationSPLReadingPayload | null;
  generatorState: CalibrationGeneratorStatePayload | null;
}

const STEPS: SequenceStep[] = ['idle', 'measuring_left', 'measuring_right', 'measuring_sub', 'complete'];
const STEP_LABELS: Record<SequenceStep, string> = {
  idle: 'Idle',
  measuring_left: 'Left',
  measuring_right: 'Right',
  measuring_sub: 'Sub',
  complete: 'Done',
};

function StepIndicator({ step, activeStep }: { step: SequenceStep; activeStep: SequenceStep }): React.ReactElement {
  const idx = STEPS.indexOf(step);
  const activeIdx = STEPS.indexOf(activeStep);

  let marker: string;
  let color: string;
  if (idx < activeIdx) {
    marker = '\u2713'; // checkmark
    color = 'green';
  } else if (idx === activeIdx) {
    marker = '\u25B6'; // right-pointing triangle
    color = 'yellow';
  } else {
    marker = '\u25CB'; // open circle
    color = 'gray';
  }

  return (
    <Text color={color}>
      {marker} {STEP_LABELS[step]}
    </Text>
  );
}

export function WorkflowPane({
  session,
  currentStep,
  sessionCompleted,
  splReading,
  generatorState,
}: WorkflowPaneProps): React.ReactElement {
  const activeStep: SequenceStep = sessionCompleted
    ? 'complete'
    : currentStep?.current_step ?? 'idle';

  const guidance = currentStep?.guidance ?? (sessionCompleted ? 'Session complete.' : 'Waiting for session...');

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} width="50%">
      <Text bold underline>
        Workflow
      </Text>

      {/* Session ID */}
      <Box marginTop={1}>
        <Text dimColor>Session: </Text>
        <Text>{session?.session_id ?? '---'}</Text>
      </Box>

      {/* Step progress */}
      <Box flexDirection="column" marginTop={1}>
        {STEPS.map((step) => (
          <StepIndicator key={step} step={step} activeStep={activeStep} />
        ))}
      </Box>

      {/* Guidance */}
      <Box marginTop={1}>
        <Text italic color="cyan">
          {guidance}
        </Text>
      </Box>

      {/* Calibration section */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>
          Calibration
        </Text>
        <Box gap={1}>
          <Text dimColor>SPL:</Text>
          <Text>
            {splReading
              ? `${splReading.current_spl?.toFixed(1) ?? '?'} / ${splReading.target_spl.toFixed(1)} dB`
              : '---'}
          </Text>
          {splReading && (
            <Text color={splReading.within_tolerance ? 'green' : 'yellow'}>
              {splReading.within_tolerance ? '\u2713' : `\u0394${splReading.adjustment_db?.toFixed(1) ?? '?'} dB`}
            </Text>
          )}
        </Box>
        <Box gap={1}>
          <Text dimColor>Generator:</Text>
          <Text>
            {generatorState
              ? `${generatorState.playing ? 'Playing' : 'Stopped'} (${generatorState.signal_type} @ ${generatorState.level_dbfs} dBFS)`
              : '---'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
