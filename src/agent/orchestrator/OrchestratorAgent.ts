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

  constructor(config: SubAgentConfig) {
    this.config = config;
    this.chatService = createChatService(config.config);
  }

  async run(task: string, context?: TaskDelegation['context']): Promise<AgentResponse> {
    const startTime = Date.now();
    const messages: Message[] = [
      { role: 'system', content: this.config.systemPrompt },
      ...(context?.messages || []),
      {
        role: 'user',
        content: context?.previousResults
          ? `Previous results:\n${context.previousResults}\n\n---\n\n${task}`
          : task,
      },
    ];

    try {
      const result = await this.chatService.chat(messages, undefined);
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
      return {
        agentName: this.config.name,
        content: '',
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    }
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
    context?: TaskDelegation['context']
  ): Promise<AgentResponse> {
    const runner = this.agents.get(agentName);
    if (!runner) {
      throw new Error(`Orchestrator: Agent "${agentName}" not found. Registered: [${this.getRegisteredAgents().join(', ')}]`);
    }
    return runner.run(task, context);
  }

  /**
   * Run multiple tasks in parallel across different agents
   * Each delegation in the array runs concurrently
   */
  async delegateParallel(delegations: TaskDelegation[]): Promise<AgentResponse[]> {
    const results = await Promise.allSettled(
      delegations.map(d => this.delegate(d.agentName, d.task, d.context))
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        agentName: delegations[i].agentName,
        content: '',
        metadata: { durationMs: 0 },
      };
    });
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
   */
  async orchestrate(
    complexTask: string,
    subTasks: Record<string, string>,
    synthesiserName?: string
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const delegations: TaskDelegation[] = Object.entries(subTasks).map(
      ([agentName, task]) => ({
        agentName,
        task: `Task: ${complexTask}\n\nYour assignment:\n${task}`,
      })
    );

    // Phase 1: Run all sub-agents in parallel
    const responses = await this.delegateParallel(delegations);

    // Phase 2: Synthesize results
    const synthesiser = synthesiserName || this.getRegisteredAgents()[0];
    const synthesisPrompt = responses
      .map(r => `[${r.agentName}]:\n${r.content || '(no response)'}`)
      .join('\n\n---\n\n');

    let summary = '';
    if (synthesiser && responses.length > 1) {
      try {
        const synthesis = await this.delegate(synthesiser, `Synthesize the following analysis from multiple agents into a concise summary:\n\n${synthesisPrompt}`);
        summary = synthesis.content;
      } catch {
        summary = `[Multi-agent orchestration complete — ${responses.length} agents responded]`;
      }
    } else {
      summary = responses[0]?.content || '';
    }

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
