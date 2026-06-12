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
}
export declare class OpenAIChatService implements IChatService {
    private client;
    private model;
    constructor(config: ChatServiceConfig);
    chat(messages: Message[], tools?: ToolDefinition[], signal?: AbortSignal, streamCallbacks?: StreamCallbacks): Promise<ChatResponse>;
    private convertMessage;
}
export declare function createChatService(config: ChatServiceConfig): IChatService;
//# sourceMappingURL=ChatService.d.ts.map