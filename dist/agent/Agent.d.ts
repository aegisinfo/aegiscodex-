/**
 * Agent 核心类 - 无状态设计
 *
 *
 * 1. Agent 本身不保存任何会话状态（sessionId, messages 等）
 * 2. 所有状态通过 context 参数传入
 * 3. Agent 实例可以每次命令创建，用完即弃
 * 4. 历史连续性由外部 SessionContext 保证
 */
import type { AgentConfig, AgentOptions, ChatContext, LoopOptions, IChatService } from './types.js';
import { ExecutionPipeline, ToolRegistry } from '../tools/index.js';
export declare class Agent {
    private config;
    private runtimeOptions;
    private isInitialized;
    private chatService;
    private systemPrompt;
    private toolRegistry;
    private executionPipeline;
    /** Stable session ID reused across all chat() calls — enables cross-session memory */
    private agentSessionId;
    /**
     *
     */
    private constructor();
    /**
     *
     *
     * @param config Agent 配置
     * @param options 运行时选项
     */
    static create(config: AgentConfig, options?: AgentOptions): Promise<Agent>;
    /**
     *
     */
    private initialize;
    /** Expose chat service so callers (e.g. auto-compact) can use the configured LLM. */
    getChatService(): IChatService;
    /**
     *
     *
     * @param message 用户消息
     * @param context 聊天上下文（包含历史消息、sessionId 等）
     * @param options 循环选项
     */
    chat(message: string, context?: ChatContext, options?: LoopOptions): Promise<string>;
    /**
     *
     */
    getConfig(): AgentConfig;
    /**
     *
     *
     *
     */
    private executeLoop;
    /**
     *
     */
    private detectIncompleteIntent;
    /**
     *
     *
     *
     */
    private executeToolCall;
    /**
     *
     */
    private mapPermissionMode;
    /**
     *
     */
    getToolRegistry(): ToolRegistry;
    /**
     *
     */
    getExecutionPipeline(): ExecutionPipeline;
    /**
     *
     *
     *
     */
    private registerMcpTools;
}
export default Agent;
//# sourceMappingURL=Agent.d.ts.map