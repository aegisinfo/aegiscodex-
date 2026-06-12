/**
 * SimpleAgent - 最简单的 LLM 交互实现
 *
 *
 *
 */
import OpenAI from 'openai';
export class SimpleAgent {
    client;
    model;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
        this.model = config.model || 'claude-sonnet-4-6';
    }
    /**
     *
     */
    async chat(message) {
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
//# sourceMappingURL=SimpleAgent.js.map