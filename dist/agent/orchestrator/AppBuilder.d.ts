/**
 * AppBuilder — Declarative multi-agent app framework
 *
 * Makes it trivial to build new CLI "apps" that orchestrate multiple AI agents.
 *
 * Usage:
 * ```ts
 * const auditApp = new AppBuilder('audit', 'Security Auditor')
 *   .describe('Audit codebase for security vulnerabilities')
 *   .agent('scanner', 'Vulnerability Scanner', scannerPrompt, ['Read', 'Grep', 'Glob'])
 *   .agent('analyzer', 'Risk Analyzer', analyzerPrompt, ['Read'])
 *   .agent('reporter', 'Report Generator', reporterPrompt)
 *   .register();
 * ```
 */
import { type SubAgentConfig } from './OrchestratorAgent.js';
import { type ResolvedModelConfig } from './utils.js';
export interface AppDefinition {
    /** Unique app ID (used to reference in slash commands) */
    id: string;
    /** Human-readable app name */
    name: string;
    /** Short description (shown in /help) */
    description: string;
    /** Detailed usage instructions */
    usage?: string;
    /** Example usages */
    examples?: string[];
    /** Model config (resolved lazily at run time) */
    modelConfig: () => ResolvedModelConfig;
    /** Sub-agent configurations */
    agents: SubAgentConfig[];
    /** Synthesizer agent name (defaults to first registered) */
    synthesizer?: string;
    /** Max parallel agent executions */
    concurrency?: number;
}
export interface AppRunOptions {
    /** The user's high-level task */
    task: string;
    /** Optional sub-task overrides (agentName → custom task) */
    subTasks?: Record<string, string>;
    /** Session ID for memory context sharing */
    sessionId?: string;
    /** Abort signal */
    signal?: AbortSignal;
}
export interface AppRunResult {
    /** Per-agent responses */
    responses: Array<{
        agentName: string;
        content: string;
        toolCallsCount?: number;
        durationMs?: number;
    }>;
    /** Synthesized summary */
    summary: string;
    /** Total duration */
    totalDurationMs: number;
    /** Number of agents that reported errors */
    errorCount: number;
}
export declare class AppBuilder {
    private def;
    private agents;
    private _prompts?;
    constructor(id: string, name: string);
    /** Set short description (shown in /help) */
    describe(description: string): this;
    /** Set usage instructions */
    use(usage: string): this;
    /** Add example usages */
    examples(examples: string[]): this;
    /** Set custom model resolver */
    model(resolver: () => ResolvedModelConfig): this;
    /** Set max parallelism */
    concurrency(n: number): this;
    /** Set synthesizer agent name (default: first registered) */
    synthesizer(name: string): this;
    /**
     * Register a sub-agent.
     *
     * @param name - Agent identifier (used in delegation)
     * @param role - Human-readable role name
     * @param systemPrompt - System prompt for this agent
     * @param tools - Tool names this agent can use (e.g. ['Read', 'Grep'])
     */
    agent(name: string, role: string, systemPrompt: string, tools?: string[]): this;
    /**
     * Load a built-in app template and customize it.
     * Available: 'audit', 'refactor', 'test-gen'
     */
    fromTemplate(templateId: string, overrides?: {
        name?: string;
        description?: string;
        agentPrompts?: Record<string, string>;
    }): this;
    /**
     * Build and register the app, returning the definition.
     * This also makes the app available via the slash-command system.
     */
    register(): AppDefinition;
}
/**
 * Get all registered apps.
 */
export declare function getRegisteredApps(): AppDefinition[];
/**
 * Get a specific app by ID.
 */
export declare function getApp(id: string): AppDefinition | undefined;
/**
 * Run an app by its registered ID.
 */
export declare function runApp(appId: string, options: AppRunOptions): Promise<AppRunResult>;
/** Create default built-in apps */
export declare function createBuiltinApps(): AppDefinition[];
//# sourceMappingURL=AppBuilder.d.ts.map