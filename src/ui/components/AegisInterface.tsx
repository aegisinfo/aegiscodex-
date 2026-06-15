/**
 * AegisInterface.tsx - Main CLI interface component
 *
 * Refactored to use extracted hooks: useAgent, useCommandProcessor, useTerminalSize.
 * Previously 977 lines — now ~450 lines of orchestration, with logic in focused hooks.
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';

// Store
import {
  useInitializationStatus,
  useActiveModal,
  useMessages,
  usePendingCommands,
  sessionActions,
  configActions,
  commandActions,
  getState,
  subscribe,
} from '../../store/index.js';

// Hooks
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useCtrlCHandler } from '../hooks/useCtrlCHandler.js';
import { useConfirmation } from '../hooks/useConfirmation.js';
import { useAgent } from '../hooks/useAgent.js';
import { useCommandProcessor } from '../hooks/useCommandProcessor.js';

// Components
import { MessageRenderer } from './markdown/MessageRenderer.js';
import { InputArea } from './input/InputArea.js';
import { ChatStatusBar } from './layout/ChatStatusBar.js';
import { WelcomeMessage } from './layout/WelcomeMessage.js';
import { MessageList } from './layout/MessageList.js';
import { ConfirmationPrompt } from './dialog/ConfirmationPrompt.js';
import { InteractiveSelector, type SelectorOption } from './dialog/InteractiveSelector.js';
import { SetupWizard } from './dialog/SetupWizard.js';
import { ExitMessage } from './common/ExitMessage.js';
import { ErrorBoundary } from './common/ErrorBoundary.js';

// Focus
import { FocusId, focusActions } from '../focus/index.js';

// Theme
import { themeManager } from '../themes/index.js';

// ========== Types ==========

export interface AegisInterfaceProps {
  apiKey: string;
  baseURL?: string;
  model?: string;
  initialMessage?: string;
  debug?: boolean;
  resumeSessionId?: string;
}

// ========== Memoized Sub-Components ==========

const QueuedCommands: React.FC = React.memo(() => {
  const pendingCommands = usePendingCommands();
  const theme = themeManager.getTheme();

  if (pendingCommands.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.colors.text.muted} dimColor>
        {'\u2500\u2500'} Queued ({pendingCommands.length}) {'\u2500\u2500'}
      </Text>
      {pendingCommands.map((cmd, index) => (
        <Box key={index} marginLeft={2}>
          <Text color={theme.colors.text.muted} dimColor>
            {index + 1}. {cmd.length > 60 ? cmd.slice(0, 57) + '...' : cmd}
          </Text>
        </Box>
      ))}
    </Box>
  );
});

QueuedCommands.displayName = 'QueuedCommands';

const RecentMessagesPreview: React.FC<{ terminalWidth: number; count?: number }> = React.memo(
  ({ terminalWidth, count = 3 }) => {
    const messages = getState().session.messages;
    const recentMessages = messages.slice(-count);

    return (
      <Box flexDirection="column" marginBottom={1}>
        {recentMessages.map((msg, index) => (
          <MessageRenderer
            key={msg.id || index}
            content={msg.content}
            role={msg.role}
            terminalWidth={terminalWidth}
            showPrefix={true}
          />
        ))}
      </Box>
    );
  }
);

RecentMessagesPreview.displayName = 'RecentMessagesPreview';

// ========== Main Component ==========

export const AegisInterface: React.FC<AegisInterfaceProps> = ({
  apiKey,
  baseURL,
  model,
  initialMessage,
  debug,
  resumeSessionId,
}) => {
  // ==================== Terminal Size ====================
  const { width: terminalWidth, height: terminalHeight } = useTerminalSize();

  // ==================== Store State ====================
  const initializationStatus = useInitializationStatus();
  const activeModal = useActiveModal();
  const messages = useMessages();

  const getMessages = useCallback(() => getState().session.messages, []);

  // ==================== Agent Hook ====================
  const {
    agentRef,
    contextManagerRef,
    isInitializing,
    initError,
    currentModel,
    handleSetupComplete,
  } = useAgent({ apiKey, baseURL, model, debug, resumeSessionId });

  // ==================== Stable Refs ====================
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const modelRef = useRef(model);
  modelRef.current = model;
  const getMessagesRef = useRef(getMessages);
  getMessagesRef.current = getMessages;

  // ==================== Local State ====================
  const [isExiting, setIsExiting] = useState(false);
  const [exitSessionId, setExitSessionId] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const [selectorState, setSelectorState] = useState<{
    isVisible: boolean;
    title: string;
    options: SelectorOption[];
    handler: 'theme' | 'model' | null;
  }>({
    isVisible: false,
    title: '',
    options: [],
    handler: null,
  });

  // ==================== Hooks ====================
  const { confirmationState, confirmationHandler, handleResponse } = useConfirmation();
  const confirmationHandlerRef = useRef(confirmationHandler);
  confirmationHandlerRef.current = confirmationHandler;

  // Command processor — extracted hook
  const { processCommand, handleSubmit, processQueue } = useCommandProcessor({
    agentRef,
    contextManagerRef,
    modelRef,
    debugRef,
    getMessagesRef,
    confirmationHandlerRef,
    onSelectorRequest: (state) => {
      setSelectorState({
        isVisible: true,
        title: state.title,
        options: state.options,
        handler: state.handler,
      });
      focusActions.setFocus(FocusId.SELECTOR);
    },
  });

  // ESC interrupt (scrolling handled by MessageList internally)
  useInput((_input, key) => {
    if (key.escape && getState().session.isThinking) {
      commandActions().abort();
      sessionActions().setThinking(false);
    }
  });

  // ==================== Ctrl+C Handler ====================
  useCtrlCHandler({
    onInterrupt: () => {
      commandActions().abort();
      sessionActions().setThinking(false);
    },
    onBeforeExit: () => {
      const currentMessageCount = getState().session.messages.length;
      const currentSessionId = contextManagerRef.current?.getCurrentSessionId() || getState().session.sessionId;
      if (currentSessionId && currentMessageCount > 0) {
        setExitSessionId(currentSessionId);
        setIsExiting(true);
        return true;
      }
      return false;
    },
  });

  // ==================== Focus Management ====================
  useEffect(() => {
    if (confirmationState.isVisible) return;
    if (selectorState.isVisible) {
      focusActions.setFocus(FocusId.SELECTOR);
    } else if (activeModal === 'themeSelector') {
      focusActions.setFocus(FocusId.THEME_SELECTOR);
    } else {
      focusActions.setFocus(FocusId.MAIN_INPUT);
    }
  }, [confirmationState.isVisible, selectorState.isVisible, activeModal]);

  // ==================== Selector Handlers ====================
  const handleSelectorSelect = useCallback(async (value: string) => {
    const { handler } = selectorState;
    focusActions.setFocus(FocusId.MAIN_INPUT);
    setSelectorState({ isVisible: false, title: '', options: [], handler: null });

    if (handler === 'theme') {
      themeManager.setTheme(value);
      sessionActions().addAssistantMessage('✓ ' + value);
    } else if (handler === 'model') {
      if (value.startsWith('__ollama__')) {
        const modelName = value.slice('__ollama__'.length);
        const id = modelName.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
        try {
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
          try {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            cfg.models = cfg.models || [];
            if (!cfg.models.find((m: any) => m.id === id)) {
              cfg.models.push({ id, name: modelName, model: modelName, baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' });
            }
            cfg.currentModelId = id;
            fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
          } catch { /* non-fatal */ }
        } catch { /* non-fatal */ }
        configActions().updateConfig({ currentModelId: id });
        sessionActions().addAssistantMessage(`✓ ${modelName} (saved to config)`);
      } else {
        configActions().updateConfig({ currentModelId: value });
        sessionActions().addAssistantMessage('✓ ' + value);
      }
    }
  }, [selectorState]);

  const handleSelectorCancel = useCallback(() => {
    setSelectorState({ isVisible: false, title: '', options: [], handler: null });
    focusActions.setFocus(FocusId.MAIN_INPUT);
    sessionActions().addAssistantMessage('');
  }, []);

  // ==================== Queue Processor ====================
  useEffect(() => {
    let prevIsThinking = getState().session.isThinking;
    const unsubscribe = subscribe((state) => {
      const currentIsThinking = state.session.isThinking;
      const hasPending = state.command.pendingCommands.length > 0;
      if (prevIsThinking && !currentIsThinking && hasPending) {
        processQueue();
      }
      prevIsThinking = currentIsThinking;
    });
    return unsubscribe;
  }, [processQueue]);

  // ==================== Initial Message ====================
  const initialMessageSent = useRef(false);
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current && !isInitializing && agentRef.current) {
      initialMessageSent.current = true;
      handleSubmit(initialMessage);
    }
  }, [initialMessage, handleSubmit, isInitializing]);

  // ==================== Scroll State Notification ====================
  const handleScrolledUpChange = useCallback((scrolledUp: boolean) => {
    setIsScrolledUp(scrolledUp);
  }, []);

  // ==================== Render ====================

  if (isInitializing) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color="yellow"> Initializing...</Text>
        </Box>
      </Box>
    );
  }

  if (initError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Agent initialization failed:</Text>
        <Text color="red">{initError}</Text>
      </Box>
    );
  }

  if (initializationStatus === 'needsSetup') {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  const hasPendingInitialMessage = !!(initialMessage && !initialMessageSent.current);

  return (
    <Box flexDirection="column" width="100%">
      <WelcomeMessage terminalWidth={terminalWidth - 2} />

      {selectorState.isVisible ? (
        <>
          <RecentMessagesPreview terminalWidth={terminalWidth - 2} count={3} />
          <InteractiveSelector
            title={selectorState.title}
            options={selectorState.options}
            onSelect={handleSelectorSelect}
            onCancel={handleSelectorCancel}
            focusId={FocusId.SELECTOR}
          />
        </>
      ) : (
        <>
          {messages.length > 0 && (
            <ErrorBoundary name="MessageList" fallback={<Text color="red">Message list error</Text>}>
              <MessageList
                terminalWidth={terminalWidth - 2}
                terminalHeight={terminalHeight}
                onScrolledUpChange={handleScrolledUpChange}
              />
            </ErrorBoundary>
          )}
          <QueuedCommands />

          {confirmationState.isVisible && confirmationState.details && (
            <ErrorBoundary name="ConfirmationPrompt" fallback={null}>
              <ConfirmationPrompt
                details={confirmationState.details}
                onResponse={handleResponse}
              />
            </ErrorBoundary>
          )}

          <ErrorBoundary name="InputArea" fallback={<Text color="red">Input error — restart app</Text>}>
            <InputArea onSubmit={handleSubmit} />
          </ErrorBoundary>
          <ChatStatusBar
            model={currentModel}
            isScrolledUp={messages.length > 0 && isScrolledUp}
          />
        </>
      )}

      {isExiting && exitSessionId && (
        <ExitMessage sessionId={exitSessionId} />
      )}
    </Box>
  );
};
