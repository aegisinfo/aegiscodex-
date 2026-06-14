/**
 * ExitMessage - visar session-info och synkar till aegiscloud.org vid exit
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { themeManager } from '../../themes/index.js';
import { getState } from '../../../store/index.js';

interface ExitMessageProps {
  sessionId: string;
  exitDelay?: number;
}

export const ExitMessage: React.FC<ExitMessageProps> = ({
  sessionId,
  exitDelay = 800,
}) => {
  const { exit } = useApp();
  const theme = themeManager.getTheme();
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'done' | 'skip' | 'error'>('syncing');

  useEffect(() => {
    const doExit = async () => {
      const { appendToLocalMemory, syncConversation } = await import('../../../services/CloudSync.js');
      const { sharedMemory } = await import('../../../memory/SharedMemory.js');
      const storeMessages = getState().session.messages;

      if (storeMessages?.length > 0) {
        const messages = storeMessages.map((m: any) => ({
          role: m.role as string,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        }));

        // Local memory + episodic summary
        await appendToLocalMemory(sessionId, messages).catch(() => {});
        if (sharedMemory.isEnabled()) {
          try {
            const fs   = await import('fs');
            const path = await import('path');
            const os   = await import('os');
            const cfg  = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.aegiscode', 'config.json'), 'utf8'));
            const apiKey  = cfg?.default?.apiKey || cfg?.models?.find((m: any) => m.id === cfg.currentModelId)?.apiKey;
            const baseURL = cfg?.default?.baseURL || cfg?.models?.find((m: any) => m.id === cfg.currentModelId)?.baseURL;
            const model   = cfg?.default?.model   || cfg?.models?.find((m: any) => m.id === cfg.currentModelId)?.model;
            await sharedMemory.summarizeAndStoreSession(sessionId, apiKey, baseURL, model);
          } catch {}
        }

        // Cloud sync to aegiscloud.org
        try {
          const result = await syncConversation(sessionId, messages);
          if (result.reason === 'uploaded') {
            setSyncStatus('done');
          } else if (result.reason === 'error') {
            setSyncStatus('error');
          } else {
            setSyncStatus('skip');
          }
        } catch {
          setSyncStatus('skip');
        }
      } else {
        setSyncStatus('skip');
      }

      setTimeout(() => { exit(); setTimeout(() => process.exit(0), 50); }, 300);
    };
    doExit();
  }, [exit, sessionId]);

  const shortId = sessionId.length > 16
    ? `${sessionId.slice(0, 8)}..${sessionId.slice(-6)}`
    : sessionId;

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text color={theme.colors.text.muted}>─ </Text>
        <Text color={theme.colors.warning}>session saved</Text>
        <Text color={theme.colors.text.muted}> [</Text>
        <Text color={theme.colors.info}>{shortId}</Text>
        <Text color={theme.colors.text.muted}>]</Text>
        {syncStatus === 'syncing' && (
          <Text color={theme.colors.text.muted}> · syncing…</Text>
        )}
        {syncStatus === 'done' && (
          <Text color={theme.colors.success}> · synced ↑</Text>
        )}
        {syncStatus === 'error' && (
          <Text color={theme.colors.warning}> · sync failed</Text>
        )}
        {syncStatus === 'skip' && (
          <Text color={theme.colors.text.muted}> · local only</Text>
        )}
      </Box>

      <Box flexDirection="column" marginLeft={2}>
        <Text color={theme.colors.text.muted}>resume: </Text>
        <Box marginLeft={2}>
          <Text color={theme.colors.success}>aegis --continue</Text>
        </Box>
        <Box marginLeft={2}>
          <Text color={theme.colors.success}>aegis --resume </Text>
          <Text color={theme.colors.info}>{sessionId}</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default ExitMessage;
