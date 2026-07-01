/**
 * ChatService - LLM 通信服务
 */

import https from 'node:https';
import http from 'node:http';
import OpenAI from 'openai';
import type {
  Message,
  ToolDefinition,
  ChatResponse,
  IChatService,
  ToolCall,
  StreamCallbacks,
} from '../agent/types.js';
import { OpenAIEventAdapter } from './streaming/OpenAIEventAdapter.js';
import { ClaudeCliChatService } from './ClaudeCliChatService.js';
import { AnthropicChatService } from './AnthropicChatService.js';

/**
 * HTTP/1.1-only fetch for the OpenAI SDK constructor.
/**
 * HTTP/1.1-only fetch — uses Node's native https/http module instead of the
 * global fetch (which negotiates HTTP/2 via undici). Many providers (DeepSeek,
 * Groq, OpenAI, etc.) send RST_STREAM on HTTP/2 during connection setup, which
 * Node 18/20's undici surfaces as ERR_STREAM_PREMATURE_CLOSE. The https module
 * only speaks HTTP/1.1, eliminating the premature close error.
 */
/**
 * Read the entire IncomingMessage into a string buffer.
 */
function readBody(res: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    res.on('error', reject);
  });
}

function http1Fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url);
  const method = init?.method || 'POST';
  const headers = init?.headers as Record<string, string> | undefined;
  const body = init?.body;
  const signal = init?.signal;

  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers,
      timeout: 60000,
    };

    const req = mod.request(options, async (res) => {
      const status = res.statusCode ?? 500;
      const responseHeaders = new Headers();
      for (const [k, v] of Object.entries(res.headers)) {
        if (v) responseHeaders.set(k, Array.isArray(v) ? v.join(', ') : v);
      }

      // For error responses, pre-read the body so the OpenAI SDK can parse
      // error details with .text() / .json() — avoids "400 status code (no body)".
      if (status < 200 || status >= 300) {
        const errBody = await readBody(res);
        resolve(new Response(errBody, {
          status,
          statusText: res.statusMessage || '',
          headers: responseHeaders,
        }));
        return;
      }

      // Success response: wrap the Node.js stream in a web ReadableStream.
      const stream = new ReadableStream({
        start(controller) {
          res.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
          res.on('end', () => controller.close());
          res.on('error', (err) => controller.error(err));
        },
      });
      resolve(new Response(stream, {
        status,
        statusText: res.statusMessage || '',
        headers: responseHeaders,
      }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(Object.assign(new Error('timeout'), { code: 'timeout' })); });

    if (signal) {
      if (signal.aborted) { req.destroy(); return reject(new DOMException('Aborted', 'AbortError')); }
      signal.addEventListener('abort', () => { req.destroy(); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    }

    if (body) req.write(typeof body === 'string' ? body : String(body));
    req.end();
  });
}

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
  /** aegiscode's own permission mode; only consulted for OAuth (claude CLI) transport. */
  permissionMode?: string;
  /** Extended-thinking budget tier — only honored on the native Anthropic transport. */
  thinkingBudget?: 'off' | 'low' | 'medium' | 'high' | 'max';
  maxOutputTokens?: number;
}

export class OpenAIChatService implements IChatService {
  private client: OpenAI;
  private model: string;

  constructor(config: ChatServiceConfig) {
    const isAnthropic = config.baseURL?.includes('anthropic.com') ?? false;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 60000,
      defaultHeaders: isAnthropic ? {
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15',
      } : undefined,
      // Use HTTP/1.1 instead of HTTP/2 — avoids ERR_STREAM_PREMATURE_CLOSE
      // from Node's undici client on Node 18/20 (DeepSeek, Groq, etc.)
      fetch: http1Fetch as any,
    });
    this.model = config.model || 'claude-sonnet-4-6';
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    streamCallbacks?: StreamCallbacks,
    attempt = 0
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

      const requestParams: OpenAI.ChatCompletionCreateParams & { keep_alive?: number } = {
        model: this.model,
        messages: openaiMessages,
        stream: true,
      };

      // Keep Ollama models loaded in memory between requests — eliminates cold-start latency
      if (isOllama) {
        (requestParams as any).keep_alive = -1;
      }

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
      const adapter = streamCallbacks?.onStreamEvent ? new OpenAIEventAdapter() : null;
      let inOllamaThinkBlock = false;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // For ollama: extract <think>…</think> from delta.content before adapter/callbacks.
        // Ollama embeds thinking in content as tags rather than a separate reasoning_content field.
        let adaptDelta = delta as Parameters<typeof OpenAIEventAdapter.prototype.adapt>[0];
        if (isOllama && delta.content) {
          let remaining = delta.content;
          let plainContent = '';
          let thinkContent = '';

          while (remaining.length > 0) {
            if (inOllamaThinkBlock) {
              const closeIdx = remaining.indexOf('</think>');
              if (closeIdx === -1) {
                thinkContent += remaining;
                remaining = '';
              } else {
                thinkContent += remaining.slice(0, closeIdx);
                remaining = remaining.slice(closeIdx + 8);
                inOllamaThinkBlock = false;
              }
            } else {
              const openIdx = remaining.indexOf('<think>');
              if (openIdx === -1) {
                plainContent += remaining;
                remaining = '';
              } else {
                plainContent += remaining.slice(0, openIdx);
                remaining = remaining.slice(openIdx + 7);
                inOllamaThinkBlock = true;
              }
            }
          }

          adaptDelta = {
            ...delta,
            content: plainContent || null,
            reasoning_content: thinkContent || null,
          } as Parameters<typeof OpenAIEventAdapter.prototype.adapt>[0];
        }

        // Unified event path: convert chunk to AnthropicStreamEvents and emit
        if (adapter && streamCallbacks?.onStreamEvent) {
          const events = adapter.adapt(adaptDelta);
          for (const event of events) {
            streamCallbacks.onStreamEvent(event);
          }
        }

        // Legacy individual callbacks (still called for backward compat)
        if (adaptDelta.content) {
          content += adaptDelta.content;
          streamCallbacks?.onContentDelta?.(adaptDelta.content);
        }

        const reasoning = (adaptDelta as Record<string, unknown>).reasoning_content
          || (adaptDelta as Record<string, unknown>).thinking
          || (adaptDelta as Record<string, unknown>).reasoning;
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

      // Emit finalize events (content_block_stop + message_stop)
      if (adapter && streamCallbacks?.onStreamEvent) {
        const stopReason = (stream as any).finalMessage?.stop_reason;
        for (const event of adapter.finalize(stopReason)) {
          streamCallbacks.onStreamEvent(event);
        }
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
          error.message.includes('Premature close') ||
          (error as { code?: string }).code === 'ERR_STREAM_PREMATURE_CLOSE' ||
          error.message.includes('timeout')
        )
      );

      if (isTransient) {
        // Don't retry if content was already streaming: the UI buffer has partial
        // content and a retry with the same streamCallbacks would double it.
        if (content.length > 0) {
          return { content, reasoningContent: reasoningContent || undefined, usage };
        }

        const MAX_RETRIES = 5;
        if (attempt >= MAX_RETRIES) {
          const status = error instanceof OpenAI.APIError ? error.status : undefined;
          const reason = status === 429 ? 'Rate limited' : `Server error (${status ?? 'transient'})`;
          throw new Error(
            `${reason} — gave up after ${MAX_RETRIES} retries.\n` +
            (status === 429
              ? `The API is rate-limiting this key. Wait a few minutes or check usage.\n`
              : (error as Error).message)
          );
        }

        const delay = Math.min(1000 * 2 ** attempt, 16000);
        process.stderr.write(`[RETRY] attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms\n`);
        await new Promise(r => setTimeout(r, delay));
        return this.chat(messages, tools, signal, streamCallbacks, attempt + 1);
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
        // ── Gemini-specific error handling ────────────────────────────────
        const isGemini = this.model?.toLowerCase().includes('gemini') ||
          (this.client as any).baseURL?.includes('googleapis') || false;

        if (isGemini && (error.status === 400 || error.status === 403)) {
          const msg = error.message || '';
          // 403 = API key missing, forbidden, or quota exhausted on Google's side
          if (error.status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('API key not found') || msg.includes('API key') || msg.includes('PERMISSION_DENIED') || msg.includes('forbidden')) {
            throw new Error(
              `LLM API Error: Gemini API key rejected (${error.status}).\n\n` +
              `Google returned a ${error.status} — common causes:\n` +
              `  • The key is missing, expired, or has no quota left\n` +
              `  • The key doesn't have "Generative Language API" enabled\n\n` +
              `  ✓ Get a free key at: https://aistudio.google.com/app/apikey\n` +
              `  ✓ Set it in ~/.aegiscode/.env:\n` +
              `    GEMINI_API_KEY=AIza...\n\n` +
              `  ✓ Or run: aegis /model and select Gemini to set it interactively.\n`
            );
          }
          // Model not found / unsupported
          if (msg.includes('not found') || msg.includes('not supported') || msg.includes('model')) {
            throw new Error(
              `LLM API Error: Gemini model "${this.model}" not found or not supported.\n\n` +
              `Available Gemini models via this endpoint:\n` +
              `  - gemini-2.5-pro\n` +
              `  - gemini-2.5-flash\n` +
              `  - gemini-2.0-flash\n\n` +
              `Check the model name in: aegis /model\n`
            );
          }
          // Generic Gemini 400/403 — include the raw error for debugging
          throw new Error(
            `LLM API Error (Gemini ${error.status}): ${msg}\n\n` +
            `Tips:\n` +
            `  • Verify your GEMINI_API_KEY starts with "AIza"\n` +
            `  • Some Gemini models don't support tool calls — try gemini-2.5-flash\n` +
            `  • Check model name: aegis /model\n`
          );
        }

        // ── General provider error ────────────────────────────────────────
        // Detect wrong-key-format for common providers
        const errMsg = error.message || '';
        if (error.status === 401 || error.status === 403) {
          const providerHint = isGemini
            ? `  • Gemini: set GEMINI_API_KEY=AIza... in ~/.aegiscode/.env\n`
            : `  • Make sure you're using the right key for this provider\n`;
          throw new Error(
            `LLM API Error (${error.status}): Authentication failed.\n\n` +
            `  • Check your API key is correct\n` +
            `  • Verify the key hasn't expired\n` +
            providerHint +
            `  • Run: aegis /model to view/change your current model\n`
          );
        }
        throw new Error(`LLM API Error: ${errMsg}`);
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
  // Claude Code Pro/Max OAuth tokens (sk-ant-oat...) only work through the
  // real `claude` binary — Anthropic rejects direct API calls using them
  // from anything else. Same model selection, different transport.
  if (config.apiKey?.startsWith('sk-ant-oat')) {
    return new ClaudeCliChatService({ model: config.model, permissionMode: config.permissionMode });
  }
  // Native Anthropic transport — required for cache_control, thinking, and
  // citations, none of which the OpenAI-compatible shim below can carry.
  if (config.baseURL?.includes('anthropic.com')) {
    return new AnthropicChatService(config);
  }
  return new OpenAIChatService(config);
}
