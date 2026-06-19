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
import { createChatService } from '../../services/ChatService.js';
import { sharedMemory } from '../../memory/SharedMemory.js';
import { agentMemoryBus } from '../../memory/AgentMemoryBus.js';
import { agentDebug } from '../../utils/debug.js';
import { configManager } from '../../config/ConfigManager.js';
import { createToolRegistry, getBuiltinTools, ExecutionPipeline, PermissionMode, } from '../../tools/index.js';
// ========== Tool-Enabled Sub-Agent Runner ==========
/**
 * SubAgentRunner — runs one sub-agent with optional tool execution.
 *
 * Previously this was a pure LLM chat. Now it:
 * 1. Registers its allowed tools
 * 2. Passes tool definitions to the LLM
 * 3. Executes tool calls inline (like Agent.ts)
 * 4. Returns the final content + metadata
 */
class SubAgentRunner {
    chatService;
    config;
    toolRegistry;
    executionPipeline;
    currentSessionId = 'default';
    constructor(config) {
        this.config = config;
        this.chatService = createChatService(config.config);
        // Set up tool registry if this agent has tool access
        if (config.tools && config.tools.length > 0) {
            const registry = createToolRegistry();
            const builtins = getBuiltinTools();
            for (const tool of builtins) {
                if (config.tools.includes(tool.name)) {
                    registry.register(tool);
                }
            }
            this.toolRegistry = registry;
            // Use configured permission mode, or read from user's settings (default: ask for confirm)
            const mode = config.permissionMode || resolvePermissionMode();
            this.executionPipeline = new ExecutionPipeline(registry, {
                defaultMode: mode,
            });
        }
    }
    async run(task, context, sessionId) {
        const startTime = Date.now();
        const sid = sessionId || 'default';
        this.currentSessionId = sid;
        // ── Inject cross-session persistent memory ──
        const memCtx = await sharedMemory.buildContext(task, 3, sid);
        // ── Inject shared agent memory bus context (inter-agent communication) ──
        const agentContext = await agentMemoryBus.getContextForAgent(this.config.name, sid, 8, 600);
        let systemPrompt = this.config.systemPrompt;
        if (memCtx) {
            systemPrompt += '\n\n' + memCtx;
        }
        if (agentContext) {
            systemPrompt += '\n\n' + agentContext;
        }
        const messages = [
            { role: 'system', content: systemPrompt },
            ...(context?.messages || []),
        ];
        messages.push({
            role: 'user',
            content: context?.previousResults
                ? `Previous results:\n${context.previousResults}\n\n---\n\n${task}`
                : task,
        });
        // ── Build tool definitions for LLM ──
        const tools = this.toolRegistry
            ? this.toolRegistry.getFunctionDeclarationsByMode().map(fn => ({
                type: 'function',
                function: {
                    name: fn.name,
                    description: fn.description,
                    parameters: fn.parameters,
                },
            }))
            : undefined;
        // ── Execute LLM loop (max 1 turn with tools) ──
        let totalToolCalls = 0;
        try {
            const result = await this.chatService.chat(messages, tools);
            // If no tool calls — just return content
            if (!result.toolCalls || result.toolCalls.length === 0) {
                await this.publishResult(task, result.content, result.usage?.totalTokens, startTime);
                return {
                    agentName: this.config.name,
                    content: result.content,
                    metadata: {
                        tokensUsed: result.usage?.totalTokens,
                        durationMs: Date.now() - startTime,
                    },
                };
            }
            // Execute tool calls and get final content from LLM
            const finalContent = await this.executeToolCallsAndRespond(result.toolCalls, messages, tools, sid);
            totalToolCalls = result.toolCalls.length;
            await this.publishResult(task, finalContent, result.usage?.totalTokens, startTime);
            return {
                agentName: this.config.name,
                content: finalContent,
                toolCalls: result.toolCalls,
                metadata: {
                    tokensUsed: result.usage?.totalTokens,
                    durationMs: Date.now() - startTime,
                    toolCallsCount: totalToolCalls,
                },
            };
        }
        catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            agentDebug.error(`[${this.config.name}] LLM call failed: ${errMsg}`);
            agentMemoryBus.publish({
                channel: 'error',
                sourceAgent: this.config.name,
                sessionId: sid,
                content: `LLM call failed: ${errMsg}`,
                importance: 0.9,
                tags: ['error', 'llm-failure'],
            }).catch(() => { });
            return {
                agentName: this.config.name,
                content: `[Error: ${errMsg}]`,
                metadata: {
                    durationMs: Date.now() - startTime,
                },
            };
        }
    }
    /**
     * Execute tool calls, feed results back to LLM, return final response.
     */
    async executeToolCallsAndRespond(toolCalls, messages, tools, sessionId) {
        if (!this.executionPipeline) {
            return toolCalls.map(tc => `[tool call: ${tc.function.name}]`).join('\n');
        }
        // Add assistant message with tool calls
        messages.push({
            role: 'assistant',
            content: '',
            tool_calls: toolCalls,
        });
        // Execute each tool call
        for (const tc of toolCalls) {
            if (tc.type !== 'function')
                continue;
            let params;
            try {
                params = JSON.parse(tc.function.arguments);
            }
            catch {
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    name: tc.function.name,
                    content: `Error: Invalid JSON arguments: ${tc.function.arguments}`,
                });
                continue;
            }
            const pipelineContext = {
                sessionId,
                workspaceRoot: process.cwd(),
                permissionMode: this.config.permissionMode || resolvePermissionMode(),
                messageId: tc.id,
                confirmationHandler: this.config.confirmationHandler,
            };
            const execResult = await this.executionPipeline.execute(tc.function.name, params, pipelineContext);
            messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.function.name,
                content: execResult.llmContent || execResult.displayContent || '',
            });
        }
        // Get final response from LLM after tool execution
        try {
            const final = await this.chatService.chat(messages, tools);
            return final.content || '';
        }
        catch {
            return toolCalls.map(tc => `[${tc.function.name}: executed]`).join('\n');
        }
    }
    /**
     * Publish result to shared memory bus.
     */
    async publishResult(task, content, tokensUsed, startTime) {
        const channel = this.inferChannel(task, content);
        agentMemoryBus.publish({
            channel,
            sourceAgent: this.config.name,
            sessionId: this.currentSessionId,
            content: content.slice(0, 500),
            importance: content.length > 100 ? 0.7 : 0.4,
            tags: [this.config.role],
            metadata: { tokensUsed, taskLength: task.length },
        }).catch(() => { });
    }
    inferChannel(task, content) {
        const lowerTask = task.toLowerCase();
        const lowerContent = content.toLowerCase();
        if (lowerContent.startsWith('[error:'))
            return 'error';
        if (lowerTask.includes('review') || lowerTask.includes('audit'))
            return 'decision';
        if (lowerTask.includes('suggest') || lowerTask.includes('recommend'))
            return 'suggestion';
        if (lowerContent.includes('conclusion') || lowerContent.includes('decided') || lowerContent.includes('recommend'))
            return 'decision';
        if (lowerContent.includes('fact') || lowerContent.includes('found') || lowerContent.includes('discovered'))
            return 'fact';
        if (lowerContent.includes('question') || content.endsWith('?'))
            return 'question';
        return 'intermediate';
    }
}
// ========== Orchestrator ==========
export class OrchestratorAgent {
    agents = new Map();
    agentConfigs = new Map();
    name;
    systemPrompt;
    constructor(name, systemPrompt) {
        this.name = name;
        this.systemPrompt = systemPrompt;
    }
    registerAgent(config) {
        if (this.agents.has(config.name)) {
            agentDebug.warn(`Orchestrator: Agent "${config.name}" already registered, overwriting`);
        }
        this.agents.set(config.name, new SubAgentRunner(config));
        this.agentConfigs.set(config.name, config);
    }
    unregisterAgent(name) {
        this.agents.delete(name);
        this.agentConfigs.delete(name);
    }
    getRegisteredAgents() {
        return Array.from(this.agentConfigs.keys());
    }
    getAgentConfig(name) {
        return this.agentConfigs.get(name);
    }
    async delegate(agentName, task, context, sessionId) {
        const runner = this.agents.get(agentName);
        if (!runner) {
            throw new Error(`Orchestrator: Agent "${agentName}" not found. Registered: [${this.getRegisteredAgents().join(', ')}]`);
        }
        return runner.run(task, context, sessionId);
    }
    setSessionId(sessionId) {
        this.name = this.name;
    }
    /**
     * Run multiple tasks in parallel with configurable concurrency.
     * Default concurrency = number of tasks (full parallelism).
     */
    async delegateParallel(delegations, concurrency = delegations.length, sessionId) {
        if (concurrency <= 0)
            concurrency = delegations.length;
        const results = [];
        for (let i = 0; i < delegations.length; i += concurrency) {
            const batch = delegations.slice(i, i + concurrency);
            const batchResults = await Promise.allSettled(batch.map(d => this.delegate(d.agentName, d.task, d.context, sessionId)));
            for (let j = 0; j < batchResults.length; j++) {
                const r = batchResults[j];
                if (r.status === 'fulfilled') {
                    results.push(r.value);
                }
                else {
                    const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
                    agentDebug.error(`[${batch[j].agentName}] delegateParallel unhandled: ${reason}`);
                    results.push({
                        agentName: batch[j].agentName,
                        content: `[Fatal: ${reason}]`,
                        metadata: { durationMs: 0 },
                    });
                }
            }
        }
        return results;
    }
    async delegateChain(tasks) {
        const results = [];
        let previousResults = '';
        for (const task of tasks) {
            const result = await this.delegate(task.agentName, task.task, {
                ...task.context,
                previousResults: previousResults || undefined,
            });
            results.push(result);
            if (result.content) {
                previousResults += `\n[${result.agentName}]:\n${result.content}\n`;
            }
        }
        return results;
    }
    /**
     * Full orchestration: split a complex task into sub-tasks,
     * run them in parallel, then synthesize results.
     */
    async orchestrate(complexTask, subTasks, synthesiserName, sessionId) {
        const startTime = Date.now();
        const sid = sessionId || `orchestrate-${Date.now()}`;
        const delegations = Object.entries(subTasks).map(([agentName, task]) => ({
            agentName,
            task: `Task: ${complexTask}\n\nYour assignment:\n${task}`,
        }));
        // Phase 1: Run all sub-agents fully in parallel
        const responses = await this.delegateParallel(delegations, delegations.length, sid);
        // Phase 2: Synthesize
        const MAX_RESPONSE_CHARS = 2000;
        const synthesiser = synthesiserName || this.getRegisteredAgents()[0];
        const synthesisPrompt = responses
            .map(r => {
            const body = r.content || '(no response)';
            const truncated = body.length > MAX_RESPONSE_CHARS
                ? body.slice(0, MAX_RESPONSE_CHARS) + '\n...(truncated)'
                : body;
            return `[${r.agentName}]:\n${truncated}`;
        })
            .join('\n\n---\n\n');
        let summary = '';
        if (synthesiser && responses.length > 1) {
            try {
                const synthesis = await this.delegate(synthesiser, `You are a senior technical lead synthesizing analysis from multiple specialist agents.\n\nTask: ${complexTask}\n\nAgent analyses:\n\n${synthesisPrompt}\n\n---\n\nProvide a concise, actionable summary: key findings, recommended approach, and top 3 action items.`, undefined, sid);
                summary = synthesis.content;
            }
            catch {
                summary = responses.map(r => `**${r.agentName}**: ${(r.content || '').slice(0, 300)}`).join('\n\n');
            }
        }
        else {
            summary = responses[0]?.content || '';
        }
        agentMemoryBus.publish({
            channel: 'decision',
            sourceAgent: 'orchestrator',
            sessionId: sid,
            content: `[Orchestration Summary] ${summary.slice(0, 500)}`,
            importance: 0.85,
            tags: ['orchestration', 'summary'],
            metadata: {
                agentsUsed: responses.length,
                totalDurationMs: Date.now() - startTime,
            },
        }).catch(() => { });
        const totalTokens = responses.reduce((sum, r) => sum + (r.metadata?.tokensUsed || 0), 0);
        return {
            success: responses.some(r => r.content.length > 0),
            responses,
            summary,
            metadata: {
                agentsUsed: responses.length,
                totalTokens,
                totalDurationMs: Date.now() - startTime,
            },
        };
    }
}
// ========== Factory ==========
/**
 * Resolve the user's configured permission mode, falling back to DEFAULT (ask for confirmation).
 */
function resolvePermissionMode() {
    try {
        const mode = configManager.getDefaultPermissionMode();
        switch (mode) {
            case 'autoEdit': return PermissionMode.AUTO_EDIT;
            case 'yolo': return PermissionMode.YOLO;
            case 'plan': return PermissionMode.PLAN;
            default: return PermissionMode.DEFAULT;
        }
    }
    catch {
        return PermissionMode.DEFAULT;
    }
}
export function createDefaultOrchestrator(config) {
    const agentConfig = { ...config, timeout: 180000 };
    const orchestrator = new OrchestratorAgent('AEGIS-Orchestrator', 'You are AEGIS Orchestrator, coordinating multiple specialist agents. Route tasks optimally.');
    orchestrator.registerAgent({
        name: 'architect',
        role: 'System Architect',
        systemPrompt: `You are a System Architect. Analyze code structure, dependencies, and design patterns.
Provide architectural recommendations with specific file paths and refactoring steps.
Focus on: module boundaries, data flow, API design, scalability. Be concise.

You can use Read, Grep, and Glob to explore the codebase.`,
        config: agentConfig,
        tools: ['Read', 'Grep', 'Glob'],
    });
    orchestrator.registerAgent({
        name: 'implementer',
        role: 'Implementation Engineer',
        systemPrompt: `You are an Implementation Engineer. Write clean, production-ready code.
Follow existing code patterns. Provide complete code blocks with file paths.
Focus on: correctness, error handling, TypeScript types, edge cases. Be concise.

You can use Read, Grep, Edit, and Write to modify the codebase.`,
        config: agentConfig,
        tools: ['Read', 'Edit', 'Write', 'Grep', 'Glob'],
    });
    orchestrator.registerAgent({
        name: 'reviewer',
        role: 'Code Reviewer',
        systemPrompt: `You are a Code Reviewer. Review code for bugs, security issues, and style.
Be critical but constructive. Prioritize correctness and security over style.
Focus on: logic errors, type safety, error handling, performance, security. Be concise.

You can use Read, Grep, and Glob to examine the codebase.`,
        config: agentConfig,
        tools: ['Read', 'Grep', 'Glob'],
    });
    orchestrator.registerAgent({
        name: 'debugger',
        role: 'Debugging Specialist',
        systemPrompt: `You are a Debugging Specialist. Diagnose errors systematically.
Formulate hypotheses, test each one, and reason about root causes.
Focus on: stack traces, error messages, unexpected behavior, reproduction steps. Be concise.

You can use Read, Grep, Glob, and Bash to investigate and test hypotheses.`,
        config: agentConfig,
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
    });
    orchestrator.registerAgent({
        name: 'synthesizer',
        role: 'Technical Lead Synthesizer',
        systemPrompt: `You are a senior technical lead. Given analysis from multiple specialist agents, synthesize their findings into a clear, actionable summary.
Structure your response as: key findings, recommended approach, top action items.
Be direct, concrete, and avoid repeating everything the agents said.`,
        config: agentConfig,
    });
    return orchestrator;
}
//# sourceMappingURL=OrchestratorAgent.js.map