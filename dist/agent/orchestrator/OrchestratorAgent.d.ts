/**
 * OrchestratorAgent — Multi-agent orchestration coordinator
 *
 * Capabilities:
 * - Delegates tasks to specialized sub-agents
 * - Runs agents in parallel for independent tasks
 * - Fuses results from multiple agents
 * - Routes follow-up tasks based on context
 * - Sub-agents can use real tools (Read, Edit, Write, Bash, Grep, Glob)
 */
import type { AgentConfig, Message, ToolCall } from '../types.js';
export interface SubAgentConfig {
    name: string;
    role: string;
    systemPrompt: string;
    config: AgentConfig;
    tools?: string[];
}
export interface TaskDelegation {
    agentName: string;
    task: string;
    context?: {
        messages?: Message[];
        files?: string[];
        previousResults?: string;
    };
}
export interface AgentResponse {
    agentName: string;
    content: string;
    toolCalls?: ToolCall[];
    metadata?: {
        tokensUsed?: number;
        durationMs?: number;
        toolCallsCount?: number;
    };
}
export interface OrchestrationResult {
    success: boolean;
    responses: AgentResponse[];
    summary: string;
    metadata: {
        agentsUsed: number;
        totalTokens?: number;
        totalDurationMs: number;
    };
}
export declare class OrchestratorAgent {
    private agents;
    private agentConfigs;
    private name;
    private systemPrompt;
    constructor(name: string, systemPrompt: string);
    registerAgent(config: SubAgentConfig): void;
    unregisterAgent(name: string): void;
    getRegisteredAgents(): string[];
    getAgentConfig(name: string): SubAgentConfig | undefined;
    delegate(agentName: string, task: string, context?: TaskDelegation['context'], sessionId?: string): Promise<AgentResponse>;
    setSessionId(sessionId: string): void;
    /**
     * Run multiple tasks in parallel with configurable concurrency.
     * Default concurrency = number of tasks (full parallelism).
     */
    delegateParallel(delegations: TaskDelegation[], concurrency?: number, sessionId?: string): Promise<AgentResponse[]>;
    delegateChain(tasks: TaskDelegation[]): Promise<AgentResponse[]>;
    /**
     * Full orchestration: split a complex task into sub-tasks,
     * run them in parallel, then synthesize results.
     */
    orchestrate(complexTask: string, subTasks: Record<string, string>, synthesiserName?: string, sessionId?: string): Promise<OrchestrationResult>;
}
export declare function createDefaultOrchestrator(config: AgentConfig): OrchestratorAgent;
//# sourceMappingURL=OrchestratorAgent.d.ts.map