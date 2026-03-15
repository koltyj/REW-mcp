/**
 * App — root TUI component.
 *
 * Wires together the WebSocket hook, state reducer, and all
 * dashboard components into a single layout.
 */

import React from 'react';
import { Box } from 'ink';
import { useWebSocket } from './hooks/use-websocket.js';
import { useTuiState } from './hooks/use-tui-state.js';
import { Header } from './components/header.js';
import { WorkflowPane } from './components/workflow-pane.js';
import { AnalysisPane } from './components/analysis-pane.js';
import { EventLog } from './components/event-log.js';

export interface AppProps {
  host: string;
  port: number;
}

export function App({ host, port }: AppProps): React.ReactElement {
  const { state, handleEvent } = useTuiState();

  const { status } = useWebSocket({
    host,
    port,
    onEvent: handleEvent,
  });

  return (
    <Box flexDirection="column">
      <Header
        wsStatus={status}
        connection={state.connection}
        heartbeat={state.heartbeat}
      />
      <Box>
        <WorkflowPane
          session={state.session}
          currentStep={state.currentStep}
          sessionCompleted={state.sessionCompleted}
          splReading={state.splReading}
          generatorState={state.generatorState}
        />
        <AnalysisPane
          roomAnalysis={state.roomAnalysis}
          decayAnalysis={state.decayAnalysis}
          recommendation={state.recommendation}
          progress={state.progress}
        />
      </Box>
      <EventLog entries={state.eventLog} />
    </Box>
  );
}
