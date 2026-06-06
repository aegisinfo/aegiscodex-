/**
 * 
 * 
 */

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
    arguments: string;
  };
}

/**
 * 
 * 
 */
export interface Message {
  role: MessageRole;
  content: string;
  
  
  reasoning_content?: string;
  
  
  tool_calls?: ToolCall[];
  
  
  tool_call_id?: string;
  
  
  name?: string;
}

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
 */
export interface ChatContext {
  
  sessionId: string;
  
  
  messages: Message[];
  
  
  permissionMode?: PermissionMode;
  
  
  signal?: AbortSignal;
  
  
  confirmationHandler?: ConfirmationHandler;
}

/**
 * 
 */
export interface LoopOptions {
  
  maxTurns?: number;
  
  
  signal?: AbortSignal;
  
  
  onTurnStart?: (info: { turn: number; maxTurns: number }) => void;
  
  
  onContent?: (content: string) => void;
  
  
  onContentDelta?: (delta: string) => void;
  
  
  onThinking?: (content: string) => void;
  
  
  onThinkingDelta?: (delta: string) => void;
  
  
  onToolCallStart?: (toolCall: Partial<ToolCall>) => void;
  
  
  onToolResult?: (toolCall: ToolCall, result: ToolResult) => void;
  
  
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

/**
 * 
 */
export interface ToolResult {
  success: boolean;
  
  
  displayContent?: string;
  
  
  llmContent?: string;
  
  
  error?: string;
  
  
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

/**
 */
export interface AgentConfig {
  /** API Key */
  apiKey: string;
  
  /** API Base URL */
  baseURL?: string;
  
  
  model?: string;
  
  
  maxTurns?: number;
  
  
  maxContextTokens?: number;
  
  
  maxOutputTokens?: number;
  
  
  systemPrompt?: string;
}

/**
 */
export interface AgentOptions {
  
  maxTurns?: number;
  
  
  toolWhitelist?: string[];
  
  
  toolBlacklist?: string[];
}

/**
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
  
  onContentDelta?: (delta: string) => void;
  
  onThinkingDelta?: (delta: string) => void;
  
  onToolCallStart?: (toolCall: Partial<ToolCall>) => void;
  
  onToolCallDelta?: (toolCallId: string, argumentsDelta: string) => void;
}

/**
 */
export interface IChatService {
  chat(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    streamCallbacks?: StreamCallbacks
  ): Promise<ChatResponse>;
}
