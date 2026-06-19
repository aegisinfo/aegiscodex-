/**
 * ChatService - LLM 通信服务
 */
import type { Message, ToolDefinition, ChatResponse, IChatService, StreamCallbacks } from '../agent/types.js';
export interface ChatServiceConfig {
    apiKey: string;
    baseURL?: string;
    model?: string;
    maxRetries?: number;
    timeout?: number;
    /** aegiscode's own permission mode; only consulted for OAuth (claude CLI) transport. */
    permissionMode?: string;
    /** Extended-thinking budget tier — only honored on the native Anthropic transport. */
    thinkingBudget?: 'off' | 'low' | 'medium' | 'high' | 'max';
    maxOutputTokens?: number;
}
export declare class OpenAIChatService implements IChatService {
    private client;
    private model;
    constructor(config: ChatServiceConfig);
    chat(messages: Message[], tools?: ToolDefinition[], signal?: AbortSignal, streamCallbacks?: StreamCallbacks, attempt?: number): Promise<ChatResponse>;
    private convertMessage;
}
export declare function createChatService(config: ChatServiceConfig): IChatService;
//# sourceMappingURL=ChatService.d.ts.map