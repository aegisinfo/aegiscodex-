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

import type {
  Message,
  ToolDefinition,
  ToolCall,
  ChatResponse,
  IChatService,
  StreamCallbacks,
} from '../agent/types.js';
import type { ChatServiceConfig } from './ChatService.js';
import type { AnthropicStreamEvent } from './streaming/types.js';

const EFFORT_LEVELS = new Set(['low', 'medium', 'high']);
/** 'max' maps to a fixed budget_tokens ceiling when sent via extended thinking. */
const MAX_BUDGET_TOKENS = 128000;

/** Effort + adaptive thinking are unsupported on Haiku (errors per Anthropic API). */
function modelSupportsThinking(model: string): boolean {
  return !/haiku/i.test(model);
}

type AnthropicContentBlock = Record<string, unknown>;
type AnthropicMessage = { role: 'user' | 'assistant'; content: AnthropicContentBlock[] };

/**
 * Convert aegiscode's flat Message[] (OpenAI-shaped: system/user/assistant/tool
 * roles, tool_calls, tool_call_id) into Anthropic's content-block format:
 * system goes to a top-level field, tool results fold into 'user' messages,
 * and tool_use blocks live inside 'assistant' content.
 */
function buildAnthropicMessages(messages: Message[]): { systemText: string; anthropicMessages: AnthropicMessage[] } {
  let systemText = '';
  const anthropicMessages: AnthropicMessage[] = [];

  // Tool names by call id — needed to mark Read-tool results as citable documents.
  const toolNameById = new Map<string, string>();

  // Consecutive 'tool' messages (parallel tool calls) collapse into one user message.
  let pendingToolResults: AnthropicContentBlock[] | null = null;
  const flushToolResults = () => {
    if (pendingToolResults && pendingToolResults.length > 0) {
      anthropicMessages.push({ role: 'user', content: pendingToolResults });
    }
    pendingToolResults = null;
  };

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + msg.content;
      continue;
    }

    if (msg.role === 'tool') {
      if (!pendingToolResults) pendingToolResults = [];
      const toolName = msg.name || toolNameById.get(msg.tool_call_id || '') || '';
      const resultContent: AnthropicContentBlock = toolName === 'Read'
        ? {
            type: 'document',
            source: { type: 'text', media_type: 'text/plain', data: msg.content },
            citations: { enabled: true },
          }
        : { type: 'text', text: msg.content };
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: msg.tool_call_id,
        content: [resultContent],
      });
      continue;
    }

    flushToolResults();

    if (msg.role === 'user') {
      anthropicMessages.push({ role: 'user', content: [{ type: 'text', text: msg.content }] });
      continue;
    }

    if (msg.role === 'assistant') {
      const content: AnthropicContentBlock[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.tool_calls || []) {
        toolNameById.set(tc.id, tc.function.name);
        let input: unknown = {};
        try {
          input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          input = {};
        }
        content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
      }
      anthropicMessages.push({ role: 'assistant', content });
      continue;
    }
  }
  flushToolResults();

  return { systemText, anthropicMessages };
}

export class AnthropicChatService implements IChatService {
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private timeout: number;
  private maxRetries: number;
  private thinkingBudget: 'off' | 'low' | 'medium' | 'high' | 'max';
  private maxOutputTokens: number;

  constructor(config: ChatServiceConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = (config.baseURL || 'https://api.anthropic.com/v1').replace(/\/$/, '');
    this.model = config.model || 'claude-sonnet-4-6';
    this.timeout = config.timeout ?? 60000;
    this.maxRetries = config.maxRetries ?? 2;
    this.thinkingBudget = config.thinkingBudget || 'off';
    this.maxOutputTokens = config.maxOutputTokens || 16384;
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    streamCallbacks?: StreamCallbacks,
    attempt = 0,
  ): Promise<ChatResponse> {
    const { systemText, anthropicMessages } = buildAnthropicMessages(messages);

    // Cache the conversation-history prefix: mark the last content block of the
    // second-to-last message so everything before the newest turn can hit cache
    // instead of being reprocessed at full price/latency every turn.
    if (anthropicMessages.length >= 2) {
      const prefixMessage = anthropicMessages[anthropicMessages.length - 2];
      const lastBlock = prefixMessage.content[prefixMessage.content.length - 1];
      if (lastBlock) {
        (lastBlock as Record<string, unknown>).cache_control = { type: 'ephemeral' };
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxOutputTokens,
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
      messages: anthropicMessages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      const anthropicTools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      })) as Array<Record<string, unknown>>;
      (anthropicTools[anthropicTools.length - 1] as Record<string, unknown>).cache_control = { type: 'ephemeral' };
      body.tools = anthropicTools;
    }

    if (this.thinkingBudget !== 'off' && modelSupportsThinking(this.model)) {
      if (this.thinkingBudget === 'max') {
        // 'max' is not a valid Anthropic effort value — use token-based approach instead
        body.thinking = { type: 'enabled', budget_tokens: MAX_BUDGET_TOKENS };
      } else if (EFFORT_LEVELS.has(this.thinkingBudget)) {
        body.thinking = { type: 'adaptive' };
        body.output_config = { effort: this.thinkingBudget };
      }
    }

    let content = '';
    let reasoningContent = '';
    let usage: ChatResponse['usage'] | undefined;

    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        signal,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '');
        const err: Error & { status?: number } = new Error(
          `Anthropic API error (${response.status}): ${text || response.statusText}`,
        );
        err.status = response.status;
        throw err;
      }

      const toolBlocks = new Map<number, { id: string; name: string; arguments: string }>();
      const citations: Array<{ text: string; title: string }> = [];

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);

          const dataLine = rawEvent.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;

          let event: AnthropicStreamEvent;
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }

          streamCallbacks?.onStreamEvent?.(event);

          if (event.type === 'content_block_start') {
            const block = event.content_block;
            if (block.type === 'tool_use') {
              toolBlocks.set(event.index, { id: block.id, name: block.name, arguments: '' });
              streamCallbacks?.onToolCallStart?.({
                id: block.id,
                type: 'function',
                function: { name: block.name, arguments: '' },
              });
            }
          } else if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if (delta.type === 'text_delta') {
              content += delta.text;
              streamCallbacks?.onContentDelta?.(delta.text);
            } else if (delta.type === 'thinking_delta') {
              reasoningContent += delta.thinking;
              streamCallbacks?.onThinkingDelta?.(delta.thinking);
            } else if (delta.type === 'input_json_delta') {
              const tb = toolBlocks.get(event.index);
              if (tb) {
                tb.arguments += delta.partial_json;
                streamCallbacks?.onToolCallDelta?.(tb.id, delta.partial_json);
              }
            } else if (delta.type === 'citations_delta') {
              citations.push({ text: delta.citation.cited_text, title: delta.citation.document_title || 'source' });
            }
          } else if (event.type === 'message_start') {
            const u = event.message.usage as { input_tokens?: number } | undefined;
            if (u) {
              usage = {
                promptTokens: u.input_tokens || 0,
                completionTokens: 0,
                totalTokens: u.input_tokens || 0,
              };
            }
          } else if (event.type === 'message_delta') {
            const u = event.usage as { output_tokens?: number } | undefined;
            if (u && usage) {
              usage.completionTokens = u.output_tokens || 0;
              usage.totalTokens = usage.promptTokens + usage.completionTokens;
            }
          } else if (event.type === 'error') {
            throw new Error(event.error?.message || 'Anthropic stream error');
          }
        }
      }

      // Surface citations as a compact footer — reuses the existing text-rendering
      // path instead of requiring new UI plumbing through the transcript buffer.
      if (citations.length > 0) {
        const seen = new Set<string>();
        const lines: string[] = [];
        for (const c of citations) {
          const key = `${c.title}:${c.text}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const snippet = c.text.length > 80 ? c.text.slice(0, 77) + '...' : c.text;
          lines.push(`  ${c.title}: "${snippet}"`);
        }
        const footer = `\n\n— Cited:\n${lines.join('\n')}`;
        content += footer;
        streamCallbacks?.onContentDelta?.(footer);
      }

      const result: ChatResponse = { content, reasoningContent: reasoningContent || undefined, usage };
      const toolCalls: ToolCall[] = Array.from(toolBlocks.values()).map(tb => ({
        id: tb.id,
        type: 'function' as const,
        function: { name: tb.name, arguments: tb.arguments },
      }));
      if (toolCalls.length > 0) result.toolCalls = toolCalls;
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;

      const status = (error as { status?: number }).status;
      const isTransient = (
        status !== undefined && [429, 500, 502, 503, 504].includes(status)
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
        if (content.length > 0) {
          return { content, reasoningContent: reasoningContent || undefined };
        }
        const MAX_RETRIES = 5;
        if (attempt >= MAX_RETRIES) {
          const reason = status === 429 ? 'Rate limited' : `Server error (${status ?? 'transient'})`;
          throw new Error(
            `${reason} — gave up after ${MAX_RETRIES} retries.\n` +
            (status === 429
              ? `Your account hit Anthropic's rate limit. Wait a few minutes and try again,\n` +
                `or check usage at https://claude.ai/settings/usage`
              : (error as Error).message),
          );
        }
        const delay = Math.min(1000 * 2 ** attempt, 16000);
        process.stderr.write(`[RETRY] attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms\n`);
        await new Promise(r => setTimeout(r, delay));
        return this.chat(messages, tools, signal, streamCallbacks, attempt + 1);
      }

      throw error;
    }
  }
}
