/**
 * ChatService - LLM 通信服务
 */

import OpenAI from 'openai';
import type {
  Message,
  ToolDefinition,
  ChatResponse,
  IChatService,
  ToolCall,
  StreamCallbacks,
} from '../agent/types.js';

// For local Ollama models, only include tools when the query looks like a coding task.
// This avoids sending 350+ tokens of tool schemas on every conversational message,
// which would add 25-30s of prefill time on CPU.
function ollamaQueryNeedsTools(messages: Message[]): boolean {
  const last = messages.filter(m => m.role === 'user').at(-1)?.content ?? '';
  return /\b(read|edit|write|create|delete|run|execute|bash|file|folder|dir|list|search|grep|find|install|build|test|fix|debug|refactor|rename|move|copy|open|show|cat|ls|pwd|cd|git|npm|pip|python|node)\b/i.test(last);
}

export interface ChatServiceConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
}

export class OpenAIChatService implements IChatService {
  private client: OpenAI;
  private model: string;

  constructor(config: ChatServiceConfig) {
    const isAnthropic = config.baseURL?.includes('anthropic.com') ?? false;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      maxRetries: config.maxRetries ?? 2,
      timeout: config.timeout ?? 60000,
      defaultHeaders: isAnthropic ? {
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15',
      } : undefined,
    });
    this.model = config.model || 'claude-sonnet-4-6';
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    streamCallbacks?: StreamCallbacks
  ): Promise<ChatResponse> {
    const isGroq   = (this.client as any).baseURL?.includes('groq.com') || false;
    const isOllama = (this.client as any).baseURL?.includes('11434') || false;
    let content = '';
    let reasoningContent = '';
    let usage: ChatResponse['usage'] | undefined;

    try {
      // Strip zero-width characters and control characters that cause JSON parse errors
      const cleanContent = (s: string) => s.replace(/[\u200b-\u200f\u2028-\u202f\ufeff]/g, '');
      const openaiMessages = messages.map(msg => {
        const converted = this.convertMessage(msg);
        if (typeof converted.content === 'string') {
          converted.content = cleanContent(converted.content);
        }
        return converted;
      });

      // For small local Ollama models, inject a guardrail into the system message
      // so they don't hallucinate tool calls for casual/conversational input.
      if (isOllama) {
        const sysIdx = openaiMessages.findIndex(m => m.role === 'system');
        const guardrail = '\n\nIMPORTANT: Only call tools when the user explicitly asks you to work with files, run commands, or perform a coding task. For greetings and conversational messages respond with plain text only — do NOT call any tool.';
        if (sysIdx >= 0) {
          const existing = openaiMessages[sysIdx];
          openaiMessages[sysIdx] = {
            ...existing,
            content: (typeof existing.content === 'string' ? existing.content : '') + guardrail,
          };
        }
      }

      const requestParams: OpenAI.ChatCompletionCreateParams = {
        model: this.model,
        messages: openaiMessages,
        stream: true,
      };

      const includeTools = tools && tools.length > 0 && !isGroq &&
        (!isOllama || ollamaQueryNeedsTools(messages));

      if (includeTools) {
        requestParams.tools = tools!.map(tool => ({
          type: 'function' as const,
          function: tool.function,
        }));
      }

      const stream = await this.client.chat.completions.create(
        requestParams,
        { signal }
      );

      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          content += delta.content;
          streamCallbacks?.onContentDelta?.(delta.content);
        }

        const reasoning = (delta as Record<string, unknown>).reasoning_content
          || (delta as Record<string, unknown>).thinking
          || (delta as Record<string, unknown>).reasoning;
        if (reasoning && typeof reasoning === 'string') {
          reasoningContent += reasoning;
          streamCallbacks?.onThinkingDelta?.(reasoning);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index;
            if (!toolCalls.has(index)) {
              toolCalls.set(index, {
                id: tc.id || '',
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              });
              if (tc.id && tc.function?.name) {
                streamCallbacks?.onToolCallStart?.({
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.function.name, arguments: '' },
                });
              }
            } else {
              const existing = toolCalls.get(index)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) {
                existing.arguments += tc.function.arguments;
                streamCallbacks?.onToolCallDelta?.(existing.id, tc.function.arguments);
              }
            }
          }
        }

        try {
          if (chunk.usage) {
            usage = {
              promptTokens: chunk.usage.prompt_tokens || 0,
              completionTokens: chunk.usage.completion_tokens || 0,
              totalTokens: chunk.usage.total_tokens || 0,
            };
          }
        } catch {}
      }

      const result: ChatResponse = {
        content,
        reasoningContent: reasoningContent || undefined,
        usage,
      };

      if (toolCalls.size > 0) {
        result.toolCalls = Array.from(toolCalls.values()).map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;

      // Exponential backoff for transient errors (429, 500, 503)
      const isTransient = (
        error instanceof OpenAI.APIError && [429, 500, 502, 503, 504].includes(error.status)
      ) || (
        error instanceof Error && (
          error.message.includes('Connection error') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('timeout')
        )
      );

      if (isTransient) {
        // Don't retry if content was already streaming: the UI buffer has partial
        // content and a retry with the same streamCallbacks would double it.
        if (content.length > 0) {
          return { content, reasoningContent: reasoningContent || undefined, usage };
        }
        const delay = 1000;
        process.stderr.write(`[RETRY] after ${delay}ms\n`);
        await new Promise(r => setTimeout(r, delay));
        return this.chat(messages, tools, signal, streamCallbacks);
      }

      if (error instanceof OpenAI.APIError) {
        if (isOllama && error.status === 400 && error.message.includes('does not support tools')) {
          throw new Error(
            `Model "${this.model}" does not support tools.\n\n` +
            `Switch to a tool-capable model:\n` +
            `  aegis --model llama3.2\n` +
            `  aegis --model mistral-nemo\n` +
            `  aegis --model qwen2.5-coder\n\n` +
            `Or run: ollama pull llama3.2`
          );
        }
        throw new Error(`LLM API Error: ${error.message}`);
      }
      throw error;
    }
  }

  private convertMessage(msg: Message): OpenAI.ChatCompletionMessageParam {
    switch (msg.role) {
      case 'system':
        return { role: 'system', content: msg.content };
      case 'user':
        return { role: 'user', content: msg.content };
      case 'assistant':
        const assistantMsg: any = { role: 'assistant', content: msg.content };
        if ((msg as any).reasoning_content) assistantMsg.reasoning_content = (msg as any).reasoning_content;
        if (msg.tool_calls) {
          assistantMsg.tool_calls = msg.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          }));
        }
        return assistantMsg;
      case 'tool':
        return { role: 'tool', tool_call_id: msg.tool_call_id || '', content: msg.content };
      default:
        throw new Error(`Unknown message role: ${msg.role}`);
    }
  }
}

export function createChatService(config: ChatServiceConfig): IChatService {
  return new OpenAIChatService(config);
}
