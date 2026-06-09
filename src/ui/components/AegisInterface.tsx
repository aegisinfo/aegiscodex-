/**
 * AegisInterface.tsx - Main CLI interface component
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

// ========== Batch Stream Buffer ==========

/**
 * Creates a batch stream buffer that accumulates all output locally
 * and only flushes to the store ONCE when the stream is complete.
 * This eliminates all intermediate re-renders during streaming,
 * solving the flickering/repaint problem entirely.
 */
function createBatchStreamBuffer(flushCallback?: (content: string, thinking: string) => void) {
  let contentBuffer = '';
  let thinkingBuffer = '';
  let lastFlush = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const flush = (): { content: string; thinking: string } => {
    const result = {
      content: contentBuffer,
      thinking: thinkingBuffer,
    };
    contentBuffer = '';
    thinkingBuffer = '';
    lastFlush = Date.now();
    return result;
  };

  const maybeFlush = () => {
    const { content, thinking } = flush();
    if ((content || thinking) && flushCallback) {
      flushCallback(content, thinking);
    }
  };

  // Start interval timer for periodic flush
  if (flushCallback) {
    timer = setInterval(() => {
      if (contentBuffer || thinkingBuffer) {
        maybeFlush();
      }
    }, 500);
  }

  return {
    appendContent: (delta: string) => {
      contentBuffer += delta;
      // Size threshold: flush if buffer exceeds 500 chars
      if (contentBuffer.length >= 500 || thinkingBuffer.length >= 500) {
        maybeFlush();
      }
    },
    appendThinking: (delta: string) => {
      thinkingBuffer += delta;
      if (contentBuffer.length >= 500 || thinkingBuffer.length >= 500) {
        maybeFlush();
      }
    },
    flush: (): { content: string; thinking: string } => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      return flush();
    },
    clear: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      contentBuffer = '';
      thinkingBuffer = '';
    },
    isEmpty: () => contentBuffer === '' && thinkingBuffer === '',
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
import { WelcomeMessage } from './layout/WelcomeMessage.js';
import { MessageList } from './layout/MessageList.js';
import { ConfirmationPrompt } from './dialog/ConfirmationPrompt.js';
import { InteractiveSelector, type SelectorOption } from './dialog/InteractiveSelector.js';
import { ExitMessage } from './common/ExitMessage.js';
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
  const streamingMessageIdRef = useRef<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [exitSessionId, setExitSessionId] = useState<string | null>(null);

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

  // ==================== Agent & Context Initialization ====================
  useEffect(() => {
    const initAgent = async () => {
      try {
        if (debug) {
          console.log('[DEBUG] Initializing Agent and ContextManager...');
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
              console.log('[DEBUG] Loaded session with', contextMessages.length, 'messages');
            }
          } else {
            if (debug) {
              console.log('[DEBUG] Failed to load session, creating new one');
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
          console.log('[DEBUG] Loaded', customCmdResult.count, 'custom commands');
        }
        if (customCmdResult.warnings.length > 0) {
          console.warn('[WARN] Custom commands:', customCmdResult.warnings);
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
            console.log('[DEBUG] Config paths:', configManager.getLoadedConfigPaths());
            console.log('[DEBUG] Hooks config:', JSON.stringify(hooksConfig, null, 2));
          }

          initializeHooks(hooksConfig);

          if (debug) {
            const stats = getHookStats();
            console.log('[DEBUG] Hooks stats:', stats);
          }

          await onSessionStart(currentSessionId, process.cwd());
        } catch (hookError) {
          if (debug) {
            console.warn('[DEBUG] Hooks initialization failed:', hookError);
          }
        }

        setIsInitializing(false);

        if (debug) {
          console.log('[DEBUG] Agent initialized successfully, sessionId:', currentSessionId);
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
        console.log('[DEBUG] Hook injected context:', injectedContext);
      }
      sessionActions().addAssistantMessage('[Hook] ' + injectedContext);
    }

    await ctxManager.addMessage('user', value);

    if (debugRef.current) {
      const contextMessages = ctxManager.getMessages();
      console.log('[DEBUG] Sending message:', value);
      console.log('[DEBUG] Context messages count:', contextMessages.length);
      console.log('[DEBUG] Current token count:', ctxManager.getTokenCount());
    }

    const streamingMessageId = sessionActions().startStreamingMessage();
    streamingMessageIdRef.current = streamingMessageId;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Batch buffer with background flushing: flushes to store every 500ms
    // OR every 500 chars — giving smooth progressive rendering without per-token
    // React churn.
    const doFlush = (content: string, thinking: string) => {
      if (content) {
        sessionActions().appendToStreamingMessage(streamingMessageId, content);
      }
      if (thinking) {
        sessionActions().appendThinkingToStreamingMessage(streamingMessageId, thinking);
      }
    };
    const batchBuffer = createBatchStreamBuffer(doFlush);

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
            batchBuffer.appendContent(delta);
          }
        },
        onThinkingDelta: (delta) => {
          if (!abortController.signal.aborted) {
            batchBuffer.appendThinking(delta);
          }
        },
        onToolCallStart: (toolCall) => {
          if (abortController.signal.aborted) return;
          // Tool calls need to be shown immediately — flush current buffer first
          const { content, thinking } = batchBuffer.flush();
          if (content) doFlush(content, thinking);
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

      // Flush any remaining content from buffer
      const { content, thinking } = batchBuffer.flush();
      if (content) doFlush(content, thinking);
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
        console.log('[DEBUG] Token usage - input:', inputTokens, 'output:', outputTokens);
        console.log('[DEBUG] Total context tokens:', ctxManager.getTokenCount());
      }

    } catch (error) {
      batchBuffer.clear();

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
      streamingMessageIdRef.current = null;
      sessionActions().setThinking(false);
    }
  }, []); // Zero deps! All external values accessed via refs.

  // ==================== Queue Processor ====================
  const processQueue = useCallback(async () => {
    const nextCommand = commandActions().dequeueCommand();
    if (nextCommand) {
      if (debugRef.current) {
        console.log('[DEBUG] Processing queued command:', nextCommand);
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
        console.log('[DEBUG] Command queued:', value, 'Queue size:', currentPendingCount + 1);
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
        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
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

  const messageCount = getState().session.messages.length;
  const hasPendingInitialMessage = !!(initialMessage && !initialMessageSent.current);

  return (
    <Box flexDirection="column" width="100%">

      {messageCount === 0 && !hasPendingInitialMessage && (
        <WelcomeMessage terminalWidth={terminalWidth - 2} />
      )}

      <Box flexDirection="column" marginBottom={1}>
        <MessageList terminalWidth={terminalWidth - 2} />
        <QueuedCommands />
      </Box>

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
