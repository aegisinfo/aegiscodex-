/**
 * Zustand Store 模块导出
 * 
 * 
 */

// 类
export * from './types.js';

// Vanilla Store（非 React 环
export {
  vanillaStore,
  getState,
  subscribe,
  sessionActions,
  configActions,
  appActions,
  focusActions,
  commandActions,
  getConfig,
  getCurrentModel,
  getPermissionMode,
  ensureStoreInitialized,
  subscribeToState,
  subscribeToTodos,
  subscribeToMessages,
} from './vanilla.js';

// React 选择器
export {
  useClawdStore,
  // Session
  useSessionId,
  useMessages,
  useIsThinking,
  useIsCompacting,
  useSessionError,
  useCurrentCommand,
  useTokenUsage,
  // Config
  useConfig,
  useTheme,
  usePermissionMode,
  useAllModels,
  useCurrentModel,
  // App
  useInitializationStatus,
  useInitializationError,
  useActiveModal,
  useTodos,
  useAwaitingSecondCtrlC,
  useShowAllThinking,
  useAutoRouterActiveModel,
  useRouterEnabled,
  // Focus
  useCurrentFocus,
  usePreviousFocus,
  // Command
  useIsProcessing,
  usePendingCommands,
  // 派生选择
  useContextRemaining,
  useIsInputDisabled,
  useIsBusy,
  useTodoStats,
  // 细粒度消息选择
  useMessageCount,
  useMessageById,
  useMessageIds,
  useHasStreamingMessage,
  useStreamingMessageId,
  // 组合选择
  useSessionState,
  useAppState,
} from './selectors.js';
