/**
 * 
 * 
 */

import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { vanillaStore } from './vanilla.js';
import type { ClawdStore, SessionMessage, TodoItem, FocusId } from './types.js';
import type { ModelConfig, PermissionMode } from '../config/types.js';

/**
 */
export function useClawdStore<T>(selector: (state: ClawdStore) => T): T {
  return useStore(vanillaStore, selector);
}

export const useSessionId = () =>
  useClawdStore((state) => state.session.sessionId);

export const useMessages = () =>
  useClawdStore((state) => state.session.messages);

export const useIsThinking = () =>
  useClawdStore((state) => state.session.isThinking);

export const useIsCompacting = () =>
  useClawdStore((state) => state.session.isCompacting);

export const useSessionError = () =>
  useClawdStore((state) => state.session.error);

export const useCurrentCommand = () =>
  useClawdStore((state) => state.session.currentCommand);

export const useTokenUsage = () =>
  useClawdStore((state) => state.session.tokenUsage);

export const useConfig = () =>
  useClawdStore((state) => state.config.config);

export const useTheme = () =>
  useClawdStore((state) => state.config.config?.theme || 'dark');

export const usePermissionMode = () =>
  useClawdStore(
    (state) => (state.config.config?.defaultPermissionMode || 'default') as PermissionMode
  );
const EMPTY_MODELS: ModelConfig[] = [];

export const useAllModels = () =>
  useClawdStore(
    (state) => state.config.config?.models ?? EMPTY_MODELS
  );

/**
 * 
 */
export const useCurrentModel = () =>
  useClawdStore((state) => {
    const config = state.config.config;
    if (!config) return undefined;
    if (config.currentModelId && config.models) {
      const model = config.models.find((m) => m.id === config.currentModelId);
      if (model) return model;
    }
    if (config.models && config.models.length > 0) {
      return config.models[0];
    }
    return config.default;
  });

export const useInitializationStatus = () =>
  useClawdStore((state) => state.app.initializationStatus);

export const useInitializationError = () =>
  useClawdStore((state) => state.app.initializationError);

export const useActiveModal = () =>
  useClawdStore((state) => state.app.activeModal);

export const useTodos = () =>
  useClawdStore((state) => state.app.todos);

export const useAwaitingSecondCtrlC = () =>
  useClawdStore((state) => state.app.awaitingSecondCtrlC);

export const useShowAllThinking = () =>
  useClawdStore((state) => state.app.showAllThinking);

export const useCurrentFocus = () =>
  useClawdStore((state) => state.focus.currentFocus);

export const usePreviousFocus = () =>
  useClawdStore((state) => state.focus.previousFocus);

export const useIsProcessing = () =>
  useClawdStore((state) => state.command.isProcessing);

export const usePendingCommands = () =>
  useClawdStore((state) => state.command.pendingCommands);

/**
 * 
 */
export const useContextRemaining = () =>
  useClawdStore((state) => {
    const { inputTokens, maxContextTokens } = state.session.tokenUsage;
    if (maxContextTokens <= 0) return 100;
    return Math.round(Math.max(0, 100 - (inputTokens / maxContextTokens) * 100));
  });

/**
 * 
 */
export const useIsInputDisabled = () =>
  useClawdStore((state) => {
    const isThinking = state.session.isThinking;
    const isReady = state.app.initializationStatus === 'ready';
    const hasModal =
      state.app.activeModal !== 'none' &&
      state.app.activeModal !== 'shortcuts';
    return isThinking || !isReady || hasModal;
  });

/**
 * 
 */
export const useIsBusy = () =>
  useClawdStore(
    (state) => state.session.isThinking || state.command.isProcessing
  );

/**
 * 
 */
export const useTodoStats = () =>
  useClawdStore(
    useShallow((state) => {
      const todos = state.app.todos;
      return {
        total: todos.length,
        completed: todos.filter((t) => t.status === 'completed').length,
        inProgress: todos.filter((t) => t.status === 'in_progress').length,
        pending: todos.filter((t) => t.status === 'pending').length,
      };
    })
  );

/**
 * 
 */
export const useMessageCount = () =>
  useClawdStore((state) => state.session.messages.length);

/**
 * 
 */
export const useMessageById = (id: string) =>
  useClawdStore((state) => state.session.messages.find(m => m.id === id));

/**
 * 
 */
export const useMessageIds = () =>
  useClawdStore(
    useShallow((state) => state.session.messages.map(m => m.id))
  );

/**
 * 
 */
export const useHasStreamingMessage = () =>
  useClawdStore((state) => state.session.messages.some(m => m.isStreaming));

/**
 * 
 */
export const useStreamingMessageId = () =>
  useClawdStore((state) => {
    const streaming = state.session.messages.find(m => m.isStreaming);
    return streaming?.id ?? null;
  });

/**
 * 
 */
export const useSessionState = () =>
  useClawdStore(
    useShallow((state) => ({
      sessionId: state.session.sessionId,
      messages: state.session.messages,
      isThinking: state.session.isThinking,
      currentCommand: state.session.currentCommand,
      error: state.session.error,
    }))
  );

/**
 * 
 */
export const useAppState = () =>
  useClawdStore(
    useShallow((state) => ({
      initializationStatus: state.app.initializationStatus,
      initializationError: state.app.initializationError,
      activeModal: state.app.activeModal,
    }))
  );
