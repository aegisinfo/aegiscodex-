/**
 * AegisInterface.tsx - Main CLI interface component
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

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

// Streaming buffer — direct writes to mutable buffer (no store re-renders)
import { appendToBuffer, appendThinkingToBuffer, startToolCallInBuffer, appendToolCallDelta, finishToolCallInBuffer, startBatch, batchAddUserMessage, batchAddAssistantMessage, batchSetThinking, flushBatchWithStore } from '../../store/streaming-buffer.js';

// Vanilla store — imported statically to avoid microtask breaks in processCommand
import { vanillaStore } from '../../store/vanilla.js';

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

        // Show one-time free-tier upgrade reminder if past the 1 free session
        try {
          const { sharedMemory } = await import('../../memory/SharedMemory.js');
          const reminder = sharedMemory.getUpgradeReminder(currentSessionId);
          if (reminder) {
            sessionActions().addAssistantMessage(reminder);
          }
        } catch {}

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
          modelRef.current = displayName;
          
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

    // Defocus selector immediately (imperative, not React state) so any key-repeat
    // Enter events fail the focus check in InteractiveSelector.useInput before re-firing.
    focusActions.setFocus(FocusId.MAIN_INPUT);
    setSelectorState({ isVisible: false, title: '', options: [], handler: null });

    if (handler === 'theme') {
      const { themeManager } = await import('../themes/index.js');
      themeManager.setTheme(value);
      sessionActions().addAssistantMessage('✓  ' + value);
    } else if (handler === 'model') {
      const { configActions } = await import('../../store/index.js');
      configActions().updateConfig({ currentModelId: value });
      sessionActions().addAssistantMessage('✓  ' + value);
    }
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
    // Only slash-commands remain as a dynamic import (lazy-loaded, not on the hot path before Phase 1)
    const { isSlashCommand, executeSlashCommand } = await import('../../slash-commands/index.js');

    if (isSlashCommand(value)) {
      // Phase 1: flush user message + thinking=true in a single store update so
      // clearInput() (which already ran synchronously) and Phase 1 land in fewer renders.
      startBatch();
      batchAddUserMessage(value);
      batchSetThinking(true);
      flushBatchWithStore(vanillaStore);

      try {
        const result = await executeSlashCommand(value, {
          cwd: process.cwd(),
          sessionId: sessionIdRef.current,
          messages: getMessagesRef.current(),
          contextManager: contextManagerRef.current,
          modelName: modelRef.current,
        });

        if (result.type === 'selector' && result.selector) {
          // Batch thinking=false into the finally flush — avoids a separate store
          // update that would trigger an extra Ink repaint before the selector appears.
          startBatch();
          batchSetThinking(false);
          setSelectorState({
            isVisible: true,
            title: result.selector.title,
            options: result.selector.options,
            handler: result.selector.handler,
          });
          focusActions.setFocus(FocusId.SELECTOR);
          return; // finally runs and flushes {isThinking: false} in one store update
        }

        if (result.sendToAgent && result.content) {
          startBatch();
          batchSetThinking(false);
          flushBatchWithStore(vanillaStore);
          await processCommand(result.content, { silent: true });
          return;
        }

        // Phase 2: batch the command result and flush it
        startBatch();
        if (result.content) {
          batchAddAssistantMessage(result.content);
        } else if (result.message) {
          batchAddAssistantMessage(result.message);
        } else if (result.error) {
          batchAddAssistantMessage('error: ' + result.error);
        }
      } catch (error) {
        startBatch();
        batchAddAssistantMessage(
          'error: ' + (error instanceof Error ? error.message : String(error))
        );
      } finally {
        batchSetThinking(false);
        flushBatchWithStore(vanillaStore);
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

    // Auto-compact when context approaches 80% of the token limit.
    // This prevents the Agent's hard truncation (which drops context without summarizing).
    {
      const currentTokens = ctxManager.getTokenCount();
      const runtimeConfig = getState().config.config;
      const maxCtx = (runtimeConfig as any)?.maxContextTokens ?? 200000;
      if (currentTokens > 0 && currentTokens >= maxCtx * 0.8) {
        try {
          sessionActions().setCompacting(true);
          sessionActions().addAssistantMessage('⟳ Context near limit — auto-compacting...');
          const { CompactionService } = await import('../../context/CompactionService.js');
          const ctxMsgs = ctxManager.getMessages();
          const msgs = ctxMsgs.map((m: { role: string; content: string }) => ({
            role: m.role as Message['role'],
            content: m.content,
          }));
          const result = await CompactionService.compact(msgs, {
            modelName: modelRef.current || 'claude-sonnet-4-6',
            maxContextTokens: maxCtx,
            chatService: agentRef.current?.getChatService(),
            trigger: 'auto',
            actualPreTokens: currentTokens,
          });
          if (result.success) {
            const { nanoid } = await import('nanoid');
            ctxManager.replaceMessages(result.compactedMessages.map((m: Message) => ({
              id: nanoid(),
              role: m.role as 'user' | 'assistant' | 'system' | 'tool',
              content: m.content,
              timestamp: Date.now(),
            })));
            ctxManager.updateTokenCount(result.postTokens);
            const saved = result.preTokens - result.postTokens;
            sessionActions().addAssistantMessage(
              `✓ Auto-compact: ${result.preTokens.toLocaleString()} → ${result.postTokens.toLocaleString()} tokens (−${saved.toLocaleString()})`
            );
          }
        } catch { /* non-fatal — continue without compaction */ }
        finally { sessionActions().setCompacting(false); }
      }
    }

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

    try {
      const contextMessages = ctxManager.getMessages();
      const modelName = modelRef.current || 'claude-sonnet-4-6';

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
            appendToBuffer(delta);
          }
        },
        onThinkingDelta: (delta) => {
          if (!abortController.signal.aborted) {
            appendThinkingToBuffer(delta);
          }
        },
        onToolCallStart: (toolCall) => {
          if (abortController.signal.aborted) return;
          // Flush current buffer to capture preceding text before tool call
          sessionActions().flushStreamBuffer(streamingMessageId);
          const name = toolCall.function?.name || 'tool';
          const toolId = toolCall.id || `${name}-${Date.now()}`;
          // Add tool_use content block to message
          sessionActions().addContentBlock(streamingMessageId, {
            type: 'tool_use',
            id: toolId,
            name,
            input: '',
            status: 'running',
            startedAt: Date.now(),
          });
          startToolCallInBuffer(toolId, name);
        },
        onToolCallDelta: (toolCallId, argumentsDelta) => {
          if (abortController.signal.aborted) return;
          appendToolCallDelta(toolCallId, argumentsDelta);
          sessionActions().updateToolCallInput(streamingMessageId, toolCallId, argumentsDelta);
        },
        onToolResult: (_toolCall: ToolCall, toolResult: ToolResult) => {
          if (abortController.signal.aborted) return;
          const toolId = _toolCall.id;
          const isError = !toolResult.success;
          finishToolCallInBuffer(toolId, isError);
          sessionActions().updateToolCallStatus(streamingMessageId, toolId, isError ? 'error' : 'success', Date.now());
          const resultContent = toolResult.error
            ? (toolResult.error.length > 200 ? toolResult.error.slice(0, 200) + '...' : toolResult.error)
            : (toolResult.displayContent
                ? (toolResult.displayContent.length > 200 ? toolResult.displayContent.slice(0, 200) + '...' : toolResult.displayContent)
                : '');
          sessionActions().addToolResultBlock(streamingMessageId, toolId, resultContent, isError);
        },
      });

      // Flush any remaining content from buffer — finishStreamingMessage handles this
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
      if (abortController.signal.aborted) {
        sessionActions().finishStreamingMessage(streamingMessageId);
      } else {
        const errorContent = 'Error: ' + (error as Error).message;
        sessionActions().forceAppendToMessage(streamingMessageId, errorContent);
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
