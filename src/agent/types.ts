/**
 * Agent 类型定义
 * 
 * 
 */

// ========== 消息类

/**
 * 
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * 
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;  // JSON 字符
  };
}

/**
 * 
 * 
 */
export interface Message {
  role: MessageRole;
  content: string;
  
  /** DeepSeek R1 等推理模型产生的思维链内容 */
  reasoning_content?: string;
  
  /** assistant 消息专用：发起的工具调用列表 */
  tool_calls?: ToolCall[];
  
  /** tool 消息专用：关联的调用 ID */
  tool_call_id?: string;
  
  /** tool 消息专用：工具名称 */
  name?: string;
}

// ========== 上下文类

/**
 * 
 */
export type PermissionMode = 'default' | 'autoEdit' | 'yolo' | 'plan';

/**
 * 
 */
export interface ConfirmationDetails {
  title: string;
  message: string;
  details?: string;
  risks?: string[];
  affectedFiles?: string[];
}

/**
 * 
 */
export interface ConfirmationResponse {
  approved: boolean;
  reason?: string;
  scope?: 'once' | 'session';
}

/**
 * 
 */
export interface ConfirmationHandler {
  requestConfirmation(details: ConfirmationDetails): Promise<ConfirmationResponse>;
}

/**
 * 
 * 
 * Agent 是无状态的，所有状态通过 context 传入
 */
export interface ChatContext {
  /** 会话 ID */
  sessionId: string;
  
  /** 消息历史 */
  messages: Message[];
  
  /** 权限模式 */
  permissionMode?: PermissionMode;
  
  /** 中断信号 */
  signal?: AbortSignal;
  
  /** 确认处理器 */
  confirmationHandler?: ConfirmationHandler;
}

// ========== 循环选项与结

/**
 * 
 */
export interface LoopOptions {
  /** 最大轮次 */
  maxTurns?: number;
  
  /** 中断信号 */
  signal?: AbortSignal;
  
  /** 轮次开始回调 */
  onTurnStart?: (info: { turn: number; maxTurns: number }) => void;
  
  /** 内容回调（完整内容，用于非流式场景） */
  onContent?: (content: string) => void;
  
  /** 内容增量回调（流式） */
  onContentDelta?: (delta: string) => void;
  
  /** 思考内容回调（完整内容） */
  onThinking?: (content: string) => void;
  
  /** 思考内容增量回调（流式） */
  onThinkingDelta?: (delta: string) => void;
  
  /** 工具调用开始回调 */
  onToolCallStart?: (toolCall: Partial<ToolCall>) => void;
  
  /** 工具结果回调 */
  onToolResult?: (toolCall: ToolCall, result: ToolResult) => void;
  
  /** 轮次上限回调 */
  onTurnLimitReached?: (info: { turnsCount: number }) => Promise<{ continue: boolean }>;
}

/**
 * 
 */
export type LoopErrorType = 
  | 'aborted'
  | 'max_turns_exceeded'
  | 'chat_disabled'
  | 'initialization_failed'
  | 'llm_error'
  | 'tool_error';

/**
 * 
 */
export interface LoopError {
  type: LoopErrorType;
  message?: string;
  cause?: Error;
}

/**
 * 
 */
export interface LoopResult {
  success: boolean;
  finalMessage?: string;
  error?: LoopError;
  metadata?: {
    turnsCount: number;
    toolCallsCount: number;
    totalTokens?: number;
  };
}

// ========== 工具类

/**
 * 
 */
export interface ToolResult {
  success: boolean;
  
  /** 显示给用户的内容 */
  displayContent?: string;
  
  /** 发送给 LLM 的内容 */
  llmContent?: string;
  
  /** 错误信息 */
  error?: string;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

// ========== Agent 配

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** API Key */
  apiKey: string;
  
  /** API Base URL */
  baseURL?: string;
  
  /** 模型名称 */
  model?: string;
  
  /** 最大轮次 (-1 表示无限) */
  maxTurns?: number;
  
  /** 最大上下文 Token */
  maxContextTokens?: number;
  
  /** 最大输出 Token */
  maxOutputTokens?: number;
  
  /** 系统提示词 */
  systemPrompt?: string;
}

/**
 * Agent 创建选项
 */
export interface AgentOptions {
  /** 最大轮次 */
  maxTurns?: number;
  
  /** 工具白名单 */
  toolWhitelist?: string[];
  
  /** 工具黑名单 */
  toolBlacklist?: string[];
}

// ========== ChatService 类

/**
 * ChatService 响应
 */
export interface ChatResponse {
  content: string;
  reasoningContent?: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 
 */
export interface StreamCallbacks {
  /** 内容增量回调 */
  onContentDelta?: (delta: string) => void;
  /** 思考内容增量回调 */
  onThinkingDelta?: (delta: string) => void;
  /** 工具调用开始回调 */
  onToolCallStart?: (toolCall: Partial<ToolCall>) => void;
  /** 工具调用参数增量回调 */
  onToolCallDelta?: (toolCallId: string, argumentsDelta: string) => void;
}

/**
 * ChatService 接口
 */
export interface IChatService {
  chat(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    streamCallbacks?: StreamCallbacks
  ): Promise<ChatResponse>;
}
