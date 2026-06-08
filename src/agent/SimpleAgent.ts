/**
 * SimpleAgent - 最简单的 LLM 交互实现
 * 
 * 
 * 
 */

import OpenAI from 'openai';

export interface AgentConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export class SimpleAgent {
  private client: OpenAI;
  private model: string;

  constructor(config: AgentConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  /**
   * 
   */
  async chat(message: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful coding assistant. Be concise and helpful.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
    });

    return response.choices[0]?.message?.content || '';
  }
}
