/**
 * AnthropicChatService — native Anthropic Messages API transport.
 *
 * The OpenAI-compatible shim (ChatService.ts) cannot carry `cache_control`,
 * `thinking`, or citations — Anthropic's OpenAI-compatibility layer silently
 * drops all three. This talks directly to /v1/messages over raw SSE so those
 * features actually work. Used only when the model is Anthropic and the key
 * isn't a Claude-CLI OAuth token (that path stays on ClaudeCliChatService).
 *
 * The wire-level stream events (content_block_start/delta/stop, message_*)
 * are forwarded as-is via onStreamEvent — AnthropicStreamEvent already
 * mirrors this exact shape, so no adapter layer is needed (contrast with
 * OpenAIEventAdapter, which exists only to translate other providers' shapes
 * into this one).
 */
import type { Message, ToolDefinition, ChatResponse, IChatService, StreamCallbacks } from '../agent/types.js';
import type { ChatServiceConfig } from './ChatService.js';
export declare class AnthropicChatService implements IChatService {
    private apiKey;
    private baseURL;
    private model;
    private timeout;
    private maxRetries;
    private thinkingBudget;
    private maxOutputTokens;
    constructor(config: ChatServiceConfig);
    chat(messages: Message[], tools?: ToolDefinition[], signal?: AbortSignal, streamCallbacks?: StreamCallbacks, attempt?: number): Promise<ChatResponse>;
}
//# sourceMappingURL=AnthropicChatService.d.ts.map