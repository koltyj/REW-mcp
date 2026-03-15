/**
 * Header component — connection health bar.
 *
 * Displays connection status, REW version, heartbeat latency,
 * measurement count, and Pro features badge.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ConnectionStatus } from '../hooks/use-websocket.js';
import type {
  HealthRewConnectedPayload,
  HealthHeartbeatPayload,
} from '../../events/types.js';

export interface HeaderProps {
  wsStatus: ConnectionStatus;
  connection: HealthRewConnectedPayload | null;
  heartbeat: HealthHeartbeatPayload | null;
}

export function Header({ wsStatus, connection, heartbeat }: HeaderProps): React.ReactElement {
  const statusColor = wsStatus === 'connected' ? 'green' : 'red';
  const statusDot = wsStatus === 'connected' ? '\u25CF' : '\u25CB';

  const version = connection?.rew_version ?? '---';
  const latency = heartbeat ? `${heartbeat.latency_ms.toFixed(0)}ms` : '---';
  const measurements = connection?.measurements_available ?? 0;
  const isPro = connection?.api_capabilities?.pro_features ?? false;

  return (
    <Box
      borderStyle="single"
      borderColor={statusColor}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={1}>
        <Text color={statusColor}>{statusDot}</Text>
        <Text bold>REW</Text>
        <Text dimColor>v{version}</Text>
      </Box>

      <Box gap={2}>
        <Text>
          <Text dimColor>Latency:</Text> {latency}
        </Text>
        <Text>
          <Text dimColor>Measurements:</Text> {measurements}
        </Text>
        {isPro && (
          <Text color="magenta" bold>
            PRO
          </Text>
        )}
      </Box>
    </Box>
  );
}
