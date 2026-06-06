/**
 * Token 
 * 
 * 
 */

import { encodingForModel, type Tiktoken } from 'js-tiktoken';
import type { Message } from '../agent/types.js';

export class TokenCounter {
  private static encodingCache = new Map<string, Tiktoken>();

  /**
   * 
   */
  static countTokens(messages: Message[], modelName: string): number {
    const encoding = this.getEncoding(modelName);
    let totalTokens = 0;

    for (const msg of messages) {
      // 
      totalTokens += 4;

      // Role 
      if (msg.role) {
        totalTokens += encoding.encode(msg.role).length;
      }

      // Content 
      if (msg.content) {
        if (typeof msg.content === 'string') {
          totalTokens += encoding.encode(msg.content).length;
        } else {
          totalTokens += encoding.encode(JSON.stringify(msg.content)).length;
        }
      }

      // 
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        totalTokens += this.countToolCallTokens(msg.tool_calls, encoding);
      }
    }

    return totalTokens;
  }

  /**
   * 
   */
  static countMessageTokens(message: Message, modelName: string): number {
    return this.countTokens([message], modelName);
  }

  /**
   * 
   */
  static countTextTokens(text: string, modelName: string): number {
    const encoding = this.getEncoding(modelName);
    return encoding.encode(text).length;
  }

  /**
   * 
   */
  private static countToolCallTokens(
    toolCalls: Array<{ id?: string; function?: { name?: string; arguments?: string } }>,
    encoding: Tiktoken
  ): number {
    let tokens = 0;

    for (const call of toolCalls) {
      // 
      tokens += 4;

      if (call.id) {
        tokens += encoding.encode(call.id).length;
      }

      if (call.function) {
        if (call.function.name) {
          tokens += encoding.encode(call.function.name).length;
        }
        if (call.function.arguments) {
          tokens += encoding.encode(call.function.arguments).length;
        }
      }
    }

    return tokens;
  }

  /**
   * 
   */
  static shouldCompact(
    messages: Message[],
    modelName: string,
    maxTokens: number,
    thresholdPercent: number = 0.8
  ): boolean {
    const currentTokens = this.countTokens(messages, modelName);
    const threshold = Math.floor(maxTokens * thresholdPercent);
    return currentTokens >= threshold;
  }

  /**
   * 
   */
  private static getEncoding(modelName: string): Tiktoken {
    // 
    const normalizedName = this.normalizeModelName(modelName);

    if (!this.encodingCache.has(normalizedName)) {
      try {
        const encoding = encodingForModel(normalizedName as Parameters<typeof encodingForModel>[0]);
        this.encodingCache.set(normalizedName, encoding);
      } catch {
        // Fallback to gpt-4o tokenizer
        try {
          const encoding = encodingForModel('gpt-4o');
          this.encodingCache.set(normalizedName, encoding);
        } catch {
          //
          const fallbackEncoding = {
            encode: (text: string) => new Array(Math.ceil(text.length / 4)),
            decode: () => '',
            free: () => {},
          } as unknown as Tiktoken;
          this.encodingCache.set(normalizedName, fallbackEncoding);
        }
      }
    }
    return this.encodingCache.get(normalizedName)!;
  }

  /**
   * 
   */
  private static normalizeModelName(modelName: string): string {
    // Map model names to valid js-tiktoken encodings
    const lower = modelName.toLowerCase();

    // Anthropic Claude models
    if (lower.includes('claude-sonnet-4') || lower.includes('claude-3.5') || lower.includes('claude-3')) {
      return 'gpt-4o';
    }
    if (lower.includes('claude')) {
      return 'gpt-4o';
    }
    // GPT-4o variants
    if (lower.includes('gpt-4o') || lower.includes('gpt4o')) {
      return 'gpt-4o';
    }
    // GPT-4 variants
    if (lower.includes('gpt-4') || lower.includes('gpt4')) {
      return 'gpt-4';
    }
    // GPT-3.5 variants -> gpt-4o-mini (current replacement)
    if (lower.includes('gpt-3.5') || lower.includes('gpt35') || lower.includes('gpt-3')) {
      return 'gpt-4o-mini';
    }
    // Chinese GLM models
    if (lower.includes('glm')) {
      return 'gpt-4o';
    }
    // DeepSeek models
    if (lower.includes('deepseek')) {
      return 'gpt-4o';
    }
    // Llama/Mixtral/Groq models
    if (lower.includes('llama') || lower.includes('mixtral') || lower.includes('groq')) {
      return 'gpt-4o-mini';
    }

    return modelName;
  }

  /**
   * 
   * 
   * 
   */
  static estimateTokens(text: string): number {
    // 1 token ≈ 1.5 
    // 1 token ≈ 4 
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 
   */
  static estimateMessagesTokens(messages: Message[]): number {
    let total = 0;

    for (const msg of messages) {
      // 
      total += 4;

      if (msg.content) {
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content);
        total += this.estimateTokens(content);
      }

      if (msg.tool_calls) {
        total += this.estimateTokens(JSON.stringify(msg.tool_calls));
      }
    }

    return total;
  }

  /**
   * 
   */
  static getRemainingTokens(
    messages: Message[],
    modelName: string,
    maxContextTokens: number,
    maxOutputTokens: number = 4096
  ): number {
    const currentTokens = this.countTokens(messages, modelName);
    const availableForInput = maxContextTokens - maxOutputTokens;
    return Math.max(0, availableForInput - currentTokens);
  }

  /**
   * 
   */
  static truncateMessages(
    messages: Message[],
    modelName: string,
    maxTokens: number
  ): Message[] {
    const result: Message[] = [];
    let currentTokens = 0;

    // 
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.countMessageTokens(msg, modelName);

      if (currentTokens + msgTokens > maxTokens) {
        break;
      }

      result.unshift(msg);
      currentTokens += msgTokens;
    }

    return result;
  }

  /**
   * 
   */
  static clearCache(): void {
    // js-tiktoken  Tiktoken 
    this.encodingCache.clear();
  }
}
