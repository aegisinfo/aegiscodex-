/**
 * SimpleAgent - 最简单的 LLM 交互实现
 *
 *
 *
 */
export interface AgentConfig {
    apiKey: string;
    baseURL?: string;
    model?: string;
}
export declare class SimpleAgent {
    private client;
    private model;
    constructor(config: AgentConfig);
    /**
     *
     */
    chat(message: string): Promise<string>;
}
//# sourceMappingURL=SimpleAgent.d.ts.map