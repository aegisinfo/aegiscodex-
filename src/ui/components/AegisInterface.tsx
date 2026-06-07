/**
 * AegisInterface.tsx - Main CLI interface component
 */

// Polyfill requestAnimationFrame for Bun/Node
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 100);
  (globalThis as any).cancelAnimationFrame  = (id: number) => clearTimeout(id);
}

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';

// ========== Throttled Stream Updater ==========

/**
 * Creates a RAF-based stream updater for smooth rendering
 */
function createThrottledStreamUpdater(
  updateContent: (delta: string) => void,
  updateThinking: (delta: string) => void,
  intervalMs: number = 100 // throttle re-renders to ~10fps during streaming
) {
  let contentBuffer = '';
  let thinkingBuffer = '';
  let rafId: number | null = null;
  let isDirty = false;

  const flush = () => {
    if (isDirty) {
      if (contentBuffer) {
        updateContent(contentBuffer);
        contentBuffer = '';
      }
      if (thinkingBuffer) {
        updateThinking(thinkingBuffer);
        thinkingBuffer = '';
      }
      isDirty = false;
    }
    rafId = null;
  };

  return {
    appendContent: (delta: string) => {
      contentBuffer += delta;
      isDirty = true;
      if (rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
    },
    appendThinking: (delta: string) => {
      thinkingBuffer += delta;
      isDirty = true;
      if (rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
    },
    flush: () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      flush();
    },
    clear: () => {
      contentBuffer = '';
      thinkingBuffer = '';
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}

import { Agent } from '../../agent/Agent.js';
import type { Message, ChatContext, ToolCall, ToolResult } from '../../agent/types.js';

// ========== Tool Call Formatting ==========

function formatToolArgs(name: string, argsJson?: string): string {
  if (!argsJson) return '';
  try {
    const args = JSON.parse(argsJson);
    switch (name) {
      case 'Read':
        return args.file_path || '';
      case 'Bash': {
        const cmd = args.command || '';
        return cmd.length > 80 ? cmd.slice(0, 77) + '...' : cmd;
      }
      case 'Edit':
        return args.file_path || '';
      case 'Write':
        return args.file_path || '';
      case 'Glob':
        return args.pattern || '';
      case 'Grep':
        return `${args.pattern || ''}${args.path ? ` in ${args.path}` : ''}`;
      default: {
        const entries = Object.entries(args);
        if (entries.length === 0) return '';
        const [key, val] = entries[0];
        const valStr = String(val);
        return `${key}=${valStr.length > 40 ? valStr.slice(0, 37) + '...' : valStr}`;
      }
    }
  } catch {
    return '';
  }
}

function formatToolResult(result: ToolResult): string {
  if (result.error) {
    const err = result.error
      .replace(/^(Error|error):\s*/, '')
      .split('\n')[0];
    return err.length > 50 ? err.slice(0, 47) + '...' : err;
  }
  return '';
}

// Store
import {
  useInitializationStatus,
  useActiveModal,
  useSessionId,
  useMessages,
  usePendingCommands,
  useTokenUsage,
  sessionActions,
  commandActions,
  getState,
  subscribe,
} from '../../store/index.js';

// Context
import { ContextManager, TokenCounter } from '../../context/index.js';

// Components
import { MessageRenderer } from './markdown/MessageRenderer.js';
import { InputArea } from './input/InputArea.js';
import { ChatStatusBar } from './layout/ChatStatusBar.js';
import { MessageList } from './layout/MessageList.js';
import { ConfirmationPrompt } from './dialog/ConfirmationPrompt.js';
import { InteractiveSelector, type SelectorOption } from './dialog/InteractiveSelector.js';
import { ExitMessage, ChatSearch } from './common/index.js';
import { useConfirmation } from '../hooks/useConfirmation.js';

// Hooks
import { useTerminalWidth } from '../hooks/useTerminalWidth.js';
import { useCtrlCHandler } from '../hooks/useCtrlCHandler.js';

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

/**
 * Memoized recent messages preview for selector overlay
 */
const RecentMessagesPreview: React.FC<{ terminalWidth: number; count?: number }> = React.memo(({ terminalWidth, count = 3 }) => {
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
});

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
  // ==================== Store State ====================
  const initializationStatus = useInitializationStatus();
  const activeModal = useActiveModal();
  const sessionId = useSessionId();

  // Stable getMessages
  const getMessages = useCallback(() => getState().session.messages, []);

  // ==================== Stable Refs for processCommand ====================
  // Using refs to prevent processCommand from being recreated on every prop/state change.
  // This is the single most important optimization for preventing cascading re-renders.
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const modelRef = useRef(model);
  modelRef.current = model;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const getMessagesRef = useRef(getMessages);
  getMessagesRef.current = getMessages;

  // ==================== Local State & Refs ====================
  const terminalWidth = useTerminalWidth();
  const theme = themeManager.getTheme();
  const agentRef = useRef<Agent | null>(null);
  const contextManagerRef = useRef<ContextManager | null>(null);
  const initialMessageSent = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamUpdaterRef = useRef<ReturnType<typeof createThrottledStreamUpdater> | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [exitSessionId, setExitSessionId] = useState<string | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);

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

  // Ctrl+C handler
  useCtrlCHandler({
    onInterrupt: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (streamUpdaterRef.current) {
        streamUpdaterRef.current.clear();
        streamUpdaterRef.current = null;
      }
      if (streamingMessageIdRef.current) {
        sessionActions().finishStreamingMessage(streamingMessageIdRef.current);
        streamingMessageIdRef.current = null;
      }
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

  // Ctrl+F search toggle
  useInput((_input, key) => {
    if (key.ctrl && _input === 'f') {
      setIsSearchVisible(prev => !prev);
    }
  });

  // ==================== Agent & Context Initialization ====================
  useEffect(() => {
    const initAgent = async () => {
      try {
        if (debug) {
        }

        contextManagerRef.current = new ContextManager({
          compressionThreshold: 100000,
        });

        let currentSessionId: string;

        if (resumeSessionId) {
          const loaded = await contextManagerRef.current.loadSession(resumeSessionId);

          if (loaded) {
            currentSessionId = resumeSessionId;
            const contextMessages = contextManagerRef.current.getMessages();
            contextMessages
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .forEach(m => {
                if (m.role === 'user') {
                  sessionActions().addUserMessage(m.content);
                } else if (m.role === 'assistant') {
                  sessionActions().addAssistantMessage(m.content);
                }
              });

            if (debug) {
            }
          } else {
            if (debug) {
            }
            currentSessionId = await contextManagerRef.current.createSession();
          }
        } else {
          currentSessionId = await contextManagerRef.current.createSession();
        }

        sessionActions().setSessionId(currentSessionId);

        agentRef.current = await Agent.create({
          apiKey,
          baseURL,
          model,
        });

        const { initializeCustomCommands } = await import('../../slash-commands/index.js');
        const customCmdResult = await initializeCustomCommands(process.cwd());

        if (debug && customCmdResult.count > 0) {
        }
        if (customCmdResult.warnings.length > 0) {
        }

        import('../../skills/index.js').then(({ initializeSkills }) => {
          initializeSkills(process.cwd()).catch(() => {});
        }).catch(() => {});

        try {
          const { initializeHooks, getHookStats, onSessionStart } = await import('../../hooks/index.js');
          const { ConfigManager } = await import('../../config/index.js');
          const configManager = ConfigManager.getInstance();
          const fullConfig = configManager.getConfig();
          const hooksConfig = fullConfig.hooks || {};

          if (debug) {

          }

          initializeHooks(hooksConfig);

          if (debug) {
            const stats = getHookStats();
          }

          await onSessionStart(currentSessionId, process.cwd());
        } catch (hookError) {
          if (debug) {
          }
        }

        setIsInitializing(false);

        if (debug) {
        }
      } catch (error) {
        setInitError(error instanceof Error ? error.message : '');
        setIsInitializing(false);
      }
    };

    initAgent();

    return () => {
      contextManagerRef.current?.cleanup();
    };
  }, [apiKey, baseURL, model, debug, resumeSessionId]);

  // Model switch via /model command - event subscription
  const currentModelIdRef = React.useRef(model);
  const [currentModel, setCurrentModel] = useState(model);
  
  useEffect(() => {
    const unsubscribe = subscribe((state) => {
      const newModelId = state.config.config?.currentModelId;
      if (newModelId && newModelId !== currentModelIdRef.current) {
        currentModelIdRef.current = newModelId;
        const models = state.config.config?.models || [];
        const found = models.find((m: any) => m.id === newModelId);
        if (found) {
          const displayName = found.model || found.id;
          setCurrentModel(displayName);
          
          if (agentRef.current) {
            import('../../agent/Agent.js').then(({ Agent }) => {
              const apiKey = found.apiKey || process.env.OPENAI_API_KEY || '';
              if (!apiKey) return;
              Agent.create({
                apiKey,
                baseURL: found.baseURL || (found as any).baseUrl,
                model:   displayName,
              }).then(agent => {
                agentRef.current = agent;
              }).catch(() => {});
            }).catch(() => {});
          }
        }
      }
    });
    return unsubscribe;
  }, []);

  // ==================== Focus Management ====================
  useEffect(() => {
    if (confirmationState.isVisible) {
      return;
    }
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

    if (handler === 'theme') {
      const { themeManager } = await import('../themes/index.js');
      themeManager.setTheme(value);
      sessionActions().addAssistantMessage('✓  ' + value);
    } else if (handler === 'model') {
      const { configActions } = await import('../../store/index.js');
      configActions().updateConfig({ currentModelId: value });
      sessionActions().addAssistantMessage('✓  ' + value);
    }

    setSelectorState({ isVisible: false, title: '', options: [], handler: null });
    focusActions.setFocus(FocusId.MAIN_INPUT);
  }, [selectorState]);

  const handleSelectorCancel = useCallback(() => {
    setSelectorState({ isVisible: false, title: '', options: [], handler: null });
    focusActions.setFocus(FocusId.MAIN_INPUT);
    sessionActions().addAssistantMessage('');
  }, []);

  // ==================== Core Command Processor ====================
  /**
   * processCommand with zero dependencies - uses refs for all external values.
   * This prevents cascading re-renders when props or state change.
   */
  const processCommand = useCallback(async (value: string, options?: { silent?: boolean }) => {
    const { isSlashCommand, executeSlashCommand } = await import('../../slash-commands/index.js');

    if (isSlashCommand(value)) {
      sessionActions().addUserMessage(value);
      sessionActions().setThinking(true);

      try {
        const result = await executeSlashCommand(value, {
          cwd: process.cwd(),
          sessionId: sessionIdRef.current,
          messages: getMessagesRef.current(),
          contextManager: contextManagerRef.current,
          modelName: modelRef.current,
        });

        if (result.type === 'selector' && result.selector) {
          sessionActions().setThinking(false);
          setSelectorState({
            isVisible: true,
            title: result.selector.title,
            options: result.selector.options,
            handler: result.selector.handler,
          });
          focusActions.setFocus(FocusId.SELECTOR);
          return;
        }

        if (result.sendToAgent && result.content) {
          sessionActions().setThinking(false);
          await processCommand(result.content, { silent: true });
          return;
        }

        if (result.content) {
          sessionActions().addAssistantMessage(result.content);
        } else if (result.message) {
          sessionActions().addAssistantMessage(result.message);
        } else if (result.error) {
          sessionActions().addAssistantMessage('error: ' + result.error);
        }
      } catch (error) {
        sessionActions().addAssistantMessage(
          'error: ' + (error instanceof Error ? error.message : String(error))
        );
      } finally {
        sessionActions().setThinking(false);
      }
      return;
    }

    if (!agentRef.current || !contextManagerRef.current) return;

    const ctxManager = contextManagerRef.current;

    if (!options?.silent) {
      sessionActions().addUserMessage(value);
    }

    sessionActions().setThinking(true);

    const { onUserPromptSubmit } = await import('../../hooks/index.js');
    const injectedContext = await onUserPromptSubmit(value, sessionIdRef.current, process.cwd());

    if (injectedContext) {
      if (debugRef.current) {
      }
      sessionActions().addAssistantMessage('[Hook] ' + injectedContext);
    }

    await ctxManager.addMessage('user', value);

    if (debugRef.current) {
      const contextMessages = ctxManager.getMessages();

    }

    const streamingMessageId = sessionActions().startStreamingMessage();
    streamingMessageIdRef.current = streamingMessageId;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const streamUpdater = createThrottledStreamUpdater(
      (delta) => sessionActions().appendToStreamingMessage(streamingMessageId, delta),
      (delta) => sessionActions().appendThinkingToStreamingMessage(streamingMessageId, delta),
      100 // throttle to ~10fps to prevent screen flicker
    );
    streamUpdaterRef.current = streamUpdater;

    try {
      const contextMessages = ctxManager.getMessages();
      const modelName = modelRef.current || 'claude-sonnet-4-20250514';

      const inputTokens = TokenCounter.countTokens(
        contextMessages.map(m => ({ role: m.role as Message['role'], content: m.content })),
        modelName
      );

      const chatContext: ChatContext = {
        sessionId: ctxManager.getCurrentSessionId() || sessionIdRef.current,
        messages: contextMessages.map(m => ({
          role: m.role as Message['role'],
          content: m.content,
        })),
        confirmationHandler: confirmationHandlerRef.current,
      };

      const result = await agentRef.current.chat(value, chatContext, {
        signal: abortController.signal,
        onContentDelta: (delta) => {
          if (!abortController.signal.aborted) {
            streamUpdater.appendContent(delta);
          }
        },
        onThinkingDelta: (delta) => {
          if (!abortController.signal.aborted) {
            streamUpdater.appendThinking(delta);
          }
        },
        onToolCallStart: (toolCall) => {
          if (abortController.signal.aborted) return;
          streamUpdater.flush();
          const name = toolCall.function?.name || 'tool';
          const args = formatToolArgs(name, toolCall.function?.arguments);
          const line = args ? '\n  ' + name + ' ' + args : '\n  ' + name;
          sessionActions().appendToStreamingMessage(streamingMessageId, line);
        },
        onToolResult: (_toolCall: ToolCall, toolResult: ToolResult) => {
          if (abortController.signal.aborted) return;
          const err = formatToolResult(toolResult);
          const suffix = toolResult.success ? ' \u2713' : ' \u2717 ' + err;
          sessionActions().appendToStreamingMessage(
            streamingMessageId,
            suffix + '\n'
          );
        },
      });

      streamUpdater.flush();
      sessionActions().finishStreamingMessage(streamingMessageId);

      await ctxManager.addMessage('assistant', result);

      const outputTokens = TokenCounter.countTextTokens(result, modelName);
      const totalTokens = inputTokens + outputTokens;

      ctxManager.updateTokenCount(totalTokens);

      const currentTokenUsage = getState().session.tokenUsage;
      sessionActions().updateTokenUsage({
        inputTokens: currentTokenUsage.inputTokens + inputTokens,
        outputTokens: currentTokenUsage.outputTokens + outputTokens,
      });

      if (debugRef.current) {

      }

    } catch (error) {
      streamUpdater.clear();

      if (abortController.signal.aborted) {
        sessionActions().finishStreamingMessage(streamingMessageId);
      } else {
        const errorContent = 'Error: ' + (error as Error).message;
        sessionActions().appendToStreamingMessage(streamingMessageId, errorContent);
        sessionActions().finishStreamingMessage(streamingMessageId);
        await ctxManager.addMessage('assistant', errorContent);
      }
    } finally {
      abortControllerRef.current = null;
      streamUpdaterRef.current = null;
      streamingMessageIdRef.current = null;
      sessionActions().setThinking(false);
    }
  }, []); // Zero deps! All external values accessed via refs.

  // ==================== Queue Processor ====================
  const processQueue = useCallback(async () => {
    const nextCommand = commandActions().dequeueCommand();
    if (nextCommand) {
      if (debugRef.current) {
      }
      await processCommand(nextCommand);
    }
  }, [processCommand]); // processCommand is stable (empty deps)

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
  }, [processQueue]); // processQueue is stable

  // ==================== Command Handler ====================
  const handleSubmit = useCallback(async (value: string) => {
    if (!value.trim()) return;

    const currentState = getState();
    const currentIsThinking = currentState.session.isThinking;
    const currentPendingCount = currentState.command.pendingCommands.length;

    if (currentIsThinking) {
      commandActions().enqueueCommand(value);
      if (debugRef.current) {
      }
      return;
    }

    await processCommand(value);
  }, [processCommand]); // processCommand is stable (empty deps)

  // ==================== Initial Message ====================
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current && !isInitializing && agentRef.current) {
      initialMessageSent.current = true;
      handleSubmit(initialMessage);
    }
  }, [initialMessage, handleSubmit, isInitializing]);

  // ==================== Render ====================

  if (isInitializing) {
    return (
      <Box flexDirection="column" padding={1}>
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
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">No models configured.</Text>
        <Text color="gray">Please configure a model in ~/.aegis/config.json</Text>
      </Box>
    );
  }

  if (selectorState.isVisible) {
    return (
      <Box flexDirection="column" width="100%">
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={theme.colors.text.muted}>{'\u250C\u2500'}</Text>
            <Text bold color={theme.colors.primary}> aegis</Text>
            <Text color={theme.colors.text.secondary}>code </Text>
            <Text color={theme.colors.primary}>{'\u25C6'}</Text>
          </Box>
        </Box>

        <RecentMessagesPreview terminalWidth={terminalWidth - 2} count={3} />

        <InteractiveSelector
          title={selectorState.title}
          options={selectorState.options}
          onSelect={handleSelectorSelect}
          onCancel={handleSelectorCancel}
          focusId={FocusId.SELECTOR}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color={theme.colors.text.muted}>{'\u250C\u2500'}</Text>
          <Text bold color={theme.colors.primary}> aegis</Text>
          <Text color={theme.colors.text.secondary}>code </Text>
          <Text color={theme.colors.text.muted}>{'\u2500'} </Text>
          <Text color={theme.colors.primary}>{'\u25C6'}</Text>
          <Text color={theme.colors.text.muted} dimColor> v{process.env.npm_package_version || '0.1.0'}</Text>
          {debug && <Text color={theme.colors.warning}> [debug]</Text>}
        </Box>
        <Box>
          <Text color={theme.colors.text.muted} dimColor>{'\u2502'}  </Text>
          <Text color={theme.colors.secondary}>AEGIS</Text>
          <Text color={theme.colors.text.muted} dimColor> AI Agent {'\u00B7'} </Text>
          <Text color={theme.colors.text.muted} dimColor>multi-model</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <MessageList terminalWidth={terminalWidth - 2} />
        <QueuedCommands />
      </Box>

      {isSearchVisible && (
        <ChatSearch
          onDismiss={() => setIsSearchVisible(false)}
          onResults={(indices, currentIdx) => {
            setSearchResults(indices);
            setSearchCurrentIndex(currentIdx);
          }}
        />
      )}

      {confirmationState.isVisible && confirmationState.details && (
        <ConfirmationPrompt
          details={confirmationState.details}
          onResponse={handleResponse}
        />
      )}

      <InputArea
        onSubmit={handleSubmit}
      />

      <ChatStatusBar model={currentModel} />

      {isExiting && exitSessionId && (
        <ExitMessage sessionId={exitSessionId} />
      )}
    </Box>
  );
};
