/**
 * OrchestratorAgent — Multi-agent orchestration coordinator
 *
 * Capabilities:
 * - Delegates tasks to specialized sub-agents
 * - Runs agents in parallel for independent tasks
 * - Fuses results from multiple agents
 * - Routes follow-up tasks based on context
 */

import type { AgentConfig, Message, ToolCall } from '../types.js';
import { createChatService } from '../../services/ChatService.js';
import { sharedMemory } from '../../memory/SharedMemory.js';
import { agentMemoryBus } from '../../memory/AgentMemoryBus.js';
import { agentDebug } from '../../utils/debug.js';

// ========== Types ==========

export interface SubAgentConfig {
  name: string;
  role: string;
  systemPrompt: string;
  config: AgentConfig;
  tools?: string[]; // tool names this agent can use
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

// ========== Sub-Agent Runner ==========

class SubAgentRunner {
  private chatService: ReturnType<typeof createChatService>;
  private config: SubAgentConfig;
  // Track active session for memory bus context sharing
  private currentSessionId: string = 'default';

  constructor(config: SubAgentConfig) {
    this.config = config;
    this.chatService = createChatService(config.config);
  }

  async run(
    task: string,
    context?: TaskDelegation['context'],
    sessionId?: string,
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const sid = sessionId || 'default';
    this.currentSessionId = sid;

    // ── Inject shared memory context from other agents ──
    const agentContext = await agentMemoryBus.getContextForAgent(
      this.config.name,
      sid,
      8,    // last 8 messages
      600,  // within last 10 minutes
    );

    const messages: Message[] = [
      { role: 'system', content: this.config.systemPrompt },
      ...(context?.messages || []),
    ];

    // Add shared memory context if available
    if (agentContext) {
      messages.push({ role: 'system', content: agentContext });
    }

    messages.push({
      role: 'user',
      content: context?.previousResults
        ? `Previous results:\n${context.previousResults}\n\n---\n\n${task}`
        : task,
    });

    try {
      const result = await this.chatService.chat(messages, undefined);

      // ── Publish result to shared memory bus ──
      const channel = this.inferChannel(task, result.content);
      agentMemoryBus.publish({
        channel,
        sourceAgent: this.config.name,
        sessionId: sid,
        content: result.content.slice(0, 500),
        importance: result.content.length > 100 ? 0.7 : 0.4,
        tags: [this.config.role],
        metadata: { tokensUsed: result.usage?.totalTokens, taskLength: task.length },
      }).catch(() => {});

      return {
        agentName: this.config.name,
        content: result.content,
        toolCalls: result.toolCalls,
        metadata: {
          tokensUsed: result.usage?.totalTokens,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      agentDebug.error(`[${this.config.name}] LLM call failed: ${errMsg}`);

      // Publish error to shared memory bus
      agentMemoryBus.publish({
        channel: 'error',
        sourceAgent: this.config.name,
        sessionId: sid,
        content: `LLM call failed: ${errMsg}`,
        importance: 0.9,
        tags: ['error', 'llm-failure'],
      }).catch(() => {});

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
   * Infer the channel type from task description and result content
   */
  private inferChannel(task: string, content: string): import('../../memory/AgentMemoryBus.js').AgentChannel {
    const lowerTask = task.toLowerCase();
    const lowerContent = content.toLowerCase();

    if (lowerContent.startsWith('[error:')) return 'error';
    if (lowerTask.includes('review') || lowerTask.includes('audit')) return 'decision';
    if (lowerTask.includes('suggest') || lowerTask.includes('recommend')) return 'suggestion';
    if (lowerContent.includes('conclusion') || lowerContent.includes('decided') || lowerContent.includes('recommend'))
      return 'decision';
    if (lowerContent.includes('fact') || lowerContent.includes('found') || lowerContent.includes('discovered'))
      return 'fact';
    if (lowerContent.includes('question') || content.endsWith('?')) return 'question';

    return 'intermediate';
  }
}

// ========== Orchestrator ==========

export class OrchestratorAgent {
  private agents: Map<string, SubAgentRunner> = new Map();
  private agentConfigs: Map<string, SubAgentConfig> = new Map();
  private name: string;
  private systemPrompt: string;

  constructor(name: string, systemPrompt: string) {
    this.name = name;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Register a sub-agent with a specific role and system prompt
   */
  registerAgent(config: SubAgentConfig): void {
    if (this.agents.has(config.name)) {
      agentDebug.warn(`Orchestrator: Agent "${config.name}" already registered, overwriting`);
    }
    this.agents.set(config.name, new SubAgentRunner(config));
    this.agentConfigs.set(config.name, config);
  }

  /**
   * Remove a registered agent
   */
  unregisterAgent(name: string): void {
    this.agents.delete(name);
    this.agentConfigs.delete(name);
  }

  /**
   * Get list of registered agent names
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.agentConfigs.keys());
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(name: string): SubAgentConfig | undefined {
    return this.agentConfigs.get(name);
  }

  /**
   * Run a single task through a specific agent
   */
  async delegate(
    agentName: string,
    task: string,
    context?: TaskDelegation['context'],
    sessionId?: string,
  ): Promise<AgentResponse> {
    const runner = this.agents.get(agentName);
    if (!runner) {
      throw new Error(`Orchestrator: Agent "${agentName}" not found. Registered: [${this.getRegisteredAgents().join(', ')}]`);
    }
    return runner.run(task, context, sessionId);
  }

  /**
   * Set the active session ID for all delegations
   */
  setSessionId(sessionId: string): void {
    this.name = this.name; // Keep name, but session routing handled via delegates
  }

  /**
   * Run multiple tasks in parallel across different agents
   * Each delegation in the array runs concurrently
   */
  async delegateParallel(delegations: TaskDelegation[], concurrency: number = 2, sessionId?: string): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];
    // Run in batches to avoid overwhelming API rate limits
    for (let i = 0; i < delegations.length; i += concurrency) {
      const batch = delegations.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(d => this.delegate(d.agentName, d.task, d.context, sessionId))
      );
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
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

  /**
   * Chain: run agents sequentially, passing previous results as context
   */
  async delegateChain(tasks: TaskDelegation[]): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];
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
   * run them in parallel, then synthesize results
   *
   * @param complexTask - The high-level task description
   * @param subTasks - Map of agentName -> specific sub-task
   * @param synthesiserName - Agent to synthesize results (defaults to first registered)
   * @param sessionId - Session ID for shared memory context
   */
  async orchestrate(
    complexTask: string,
    subTasks: Record<string, string>,
    synthesiserName?: string,
    sessionId?: string,
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const sid = sessionId || `orchestrate-${Date.now()}`;
    const delegations: TaskDelegation[] = Object.entries(subTasks).map(
      ([agentName, task]) => ({
        agentName,
        task: `Task: ${complexTask}\n\nYour assignment:\n${task}`,
      })
    );

    // Phase 1: Run all sub-agents in parallel (with shared memory context)
    const responses = await this.delegateParallel(delegations, undefined, sid);

    // Phase 2: Synthesize results
    const synthesiser = synthesiserName || this.getRegisteredAgents()[0];
    const synthesisPrompt = responses
      .map(r => `[${r.agentName}]:\n${r.content || '(no response)'}`)
      .join('\n\n---\n\n');

    let summary = '';
    if (synthesiser && responses.length > 1) {
      try {
        const synthesis = await this.delegate(
          synthesiser,
          `Synthesize the following analysis from multiple agents into a concise summary:\n\n${synthesisPrompt}`,
          undefined,
          sid,
        );
        summary = synthesis.content;
      } catch {
        summary = `[Multi-agent orchestration complete — ${responses.length} agents responded]`;
      }
    } else {
      summary = responses[0]?.content || '';
    }

    // Publish orchestration summary to shared memory
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
    }).catch(() => {});

    const totalTokens = responses.reduce(
      (sum, r) => sum + (r.metadata?.tokensUsed || 0),
      0
    );

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
 * Create a pre-configured orchestrator with standard role agents
 */
export function createDefaultOrchestrator(
  config: AgentConfig
): OrchestratorAgent {
  const orchestrator = new OrchestratorAgent(
    'AEGIS-Orchestrator',
    'You are AEGIS Orchestrator, coordinating multiple specialist agents. Route tasks optimally.'
  );

  // Architect agent
  orchestrator.registerAgent({
    name: 'architect',
    role: 'System Architect',
    systemPrompt: `You are a System Architect. Analyze code structure, dependencies, and design patterns.
Provide architectural recommendations with specific file paths and refactoring steps.
Focus on: module boundaries, data flow, API design, scalability.`,
    config,
    tools: ['read', 'grep', 'glob'],
  });

  // Implementer agent
  orchestrator.registerAgent({
    name: 'implementer',
    role: 'Implementation Engineer',
    systemPrompt: `You are an Implementation Engineer. Write clean, production-ready code.
Follow existing code patterns. Provide complete code blocks with file paths.
Focus on: correctness, error handling, TypeScript types, edge cases.`,
    config,
    tools: ['read', 'edit', 'write', 'grep'],
  });

  // Reviewer agent
  orchestrator.registerAgent({
    name: 'reviewer',
    role: 'Code Reviewer',
    systemPrompt: `You are a Code Reviewer. Review code for bugs, security issues, and style.
Be critical but constructive. Prioritize correctness and security over style.
Focus on: logic errors, type safety, error handling, performance, security.`,
    config,
    tools: ['read', 'grep'],
  });

  // Debugger agent
  orchestrator.registerAgent({
    name: 'debugger',
    role: 'Debugging Specialist',
    systemPrompt: `You are a Debugging Specialist. Diagnose errors systematically.
Formulate hypotheses, test each one, and reason about root causes.
Focus on: stack traces, error messages, unexpected behavior, reproduction steps.`,
    config,
    tools: ['read', 'grep', 'bash'],
  });

  return orchestrator;
}
