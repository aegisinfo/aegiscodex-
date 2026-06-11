/**
 * Zustand Store 类型定义
 */

import type { RuntimeConfig } from '../config/types.js';

// ========== Content Block Model (mirrors Claude SSE content blocks)

export type ContentBlockType = 'text' | 'thinking' | 'tool_use' | 'tool_result';

export type ToolCallStatus = 'running' | 'success' | 'error';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: string;        // JSON args being accumulated
  status: ToolCallStatus;
  startedAt: number;
  completedAt?: number;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

// ========== 会话状

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  maxContextTokens: number;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: unknown[];
  toolCallId?: string;
  /** 思考过程内容（用于支持 DeepSeek R1 等推理模型） */
  thinking?: string;
  isStreaming?: boolean;
  /** Content blocks for structured rendering (Claude-style: text, thinking, tool_use, tool_result) */
  contentBlocks?: ContentBlock[];
}

export interface SessionState {
  sessionId: string;
  messages: SessionMessage[];
  isThinking: boolean;
  isCompacting: boolean;
  currentCommand: string | null;
  error: string | null;
  isActive: boolean;
  tokenUsage: TokenUsage;
}

export interface SessionActions {
  addMessage: (message: SessionMessage) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  /** 开始流式助手消息（创建空消息占位） */
  startStreamingMessage: () => string;
  appendToStreamingMessage: (id: string, contentDelta: string) => void;
  appendThinkingToStreamingMessage: (id: string, thinkingDelta: string) => void;
  /** Force-flush streaming buffer content to store (for tool calls, final flush) */
  flushStreamBuffer: (id: string) => void;
  /** Write directly to store message, bypassing buffer (for tool calls) */
  forceAppendToMessage: (id: string, contentDelta: string) => void;
  finishStreamingMessage: (id: string) => void;

  // ===== Content Block Operations (Claude-style) =====
  /** Add a content block to the currently streaming message */
  addContentBlock: (messageId: string, block: ContentBlock) => void;
  /** Update a tool_use block's accumulated input JSON */
  updateToolCallInput: (messageId: string, toolCallId: string, partialJson: string) => void;
  /** Update a tool_use block's status */
  updateToolCallStatus: (messageId: string, toolCallId: string, status: ToolCallStatus, completedAt?: number) => void;
  /** Add a tool_result block linked to a tool_use */
  addToolResultBlock: (messageId: string, toolUseId: string, content: string, isError: boolean) => void;

  setThinking: (isThinking: boolean) => void;
  setCompacting: (isCompacting: boolean) => void;
  setCurrentCommand: (command: string | null) => void;
  setError: (error: string | null) => void;
  setSessionId: (sessionId: string) => void;
  restoreSession: (sessionId: string, messages: SessionMessage[]) => void;
  updateTokenUsage: (usage: Partial<TokenUsage>) => void;
  clearMessages: () => void;
  resetSession: () => void;
}

export interface SessionSlice extends SessionState {
  actions: SessionActions;
}

// ========== 配置状

export interface ConfigState {
  config: RuntimeConfig | null;
}

export interface ConfigActions {
  setConfig: (config: RuntimeConfig) => void;
  updateConfig: (partial: Partial<RuntimeConfig>) => void;
}

export interface ConfigSlice extends ConfigState {
  actions: ConfigActions;
}

// ========== 应用状

export type InitializationStatus = 'pending' | 'loading' | 'ready' | 'error' | 'needsSetup';
export type ActiveModal = 'none' | 'shortcuts' | 'settings' | 'confirmation' | 'update' | 'themeSelector';

export interface AppState {
  initializationStatus: InitializationStatus;
  initializationError: string | null;
  activeModal: ActiveModal;
  awaitingSecondCtrlC: boolean;
  /** 是否展开所有思考块（全局开关） */
  showAllThinking: boolean;
  todos: TodoItem[];
}

export interface AppActions {
  setInitializationStatus: (status: InitializationStatus) => void;
  setInitializationError: (error: string | null) => void;
  setActiveModal: (modal: ActiveModal) => void;
  setTodos: (todos: TodoItem[]) => void;
  addTodo: (todo: TodoItem) => void;
  updateTodo: (id: string, updates: Partial<TodoItem>) => void;
  removeTodo: (id: string) => void;
  setAwaitingSecondCtrlC: (awaiting: boolean) => void;
  toggleShowAllThinking: () => void;
}

export interface AppSlice extends AppState {
  actions: AppActions;
}

// ========== 焦点状

export type FocusId = 'input' | 'messages' | 'confirmation' | 'modal' | 'none' | 'theme-selector' | 'selector';

/** FocusId 常量枚举 */
export const FocusId = {
  MAIN_INPUT: 'input' as FocusId,
  MESSAGES: 'messages' as FocusId,
  CONFIRMATION_PROMPT: 'confirmation' as FocusId,
  THEME_SELECTOR: 'theme-selector' as FocusId,
  SELECTOR: 'selector' as FocusId,
  MODAL: 'modal' as FocusId,
  NONE: 'none' as FocusId,
} as const;

export interface FocusState {
  currentFocus: FocusId;
  previousFocus: FocusId | null;
}

export interface FocusActions {
  setFocus: (focus: FocusId) => void;
  restoreFocus: () => void;
  pushFocus: (focus: FocusId) => void;
}

export interface FocusSlice extends FocusState {
  actions: FocusActions;
}

// ========== 命令状

export interface CommandState {
  isProcessing: boolean;
  abortController: AbortController | null;
  pendingCommands: string[];
}

export interface CommandActions {
  setProcessing: (isProcessing: boolean) => void;
  createAbortController: () => AbortController;
  abort: () => void;
  enqueueCommand: (command: string) => void;
  dequeueCommand: () => string | undefined;
  clearQueue: () => void;
}

export interface CommandSlice extends CommandState {
  actions: CommandActions;
}

// ========== 完

// ========== Todo support (for progress tracking in tasks)
export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: number;
}

export interface ClawdStore {
  session: SessionSlice;
  config: ConfigSlice;
  app: AppSlice;
  focus: FocusSlice;
  command: CommandSlice;
}
