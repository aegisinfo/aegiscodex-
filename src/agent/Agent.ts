/**
 * 
 * 
 */

import type {
  AgentConfig,
  AgentOptions,
  ChatContext,
  LoopOptions,
  LoopResult,
  Message,
  IChatService,
  ToolCall,
  ToolResult,
  ToolDefinition,
  StreamCallbacks,
} from './types.js';
import { createChatService } from '../services/ChatService.js';
import { buildSystemPrompt } from '../prompts/builder.js';
import { createPlanModeReminder } from '../prompts/plan.js';
import {
  ExecutionPipeline,
  ToolRegistry,
  createToolRegistry,
  getBuiltinTools,
  PermissionMode,
  type PipelineExecutionContext,
} from '../tools/index.js';
import { configManager } from '../config/ConfigManager.js';
import { McpRegistry } from '../mcp/index.js';
import { agentDebug } from '../utils/debug.js';
import { onStop } from '../hooks/index.js';
import { sharedMemory } from '../memory/SharedMemory.js';
import { syncSessionToDrive } from '../memory/DriveSync.js';

const TURN_LIMIT = 100;

const INCOMPLETE_INTENT_PATTERNS = [
  /：\s*$/,
  /:\s*$/,
  /\.\.\.\s*$/,
  /Let me /,
  /Let me (first|start|check|look|fix)/i,
];

// ========== Agent 

export class Agent {
  private config: AgentConfig;
  private runtimeOptions: AgentOptions;
  private isInitialized = false;
  private chatService!: IChatService;
  private systemPrompt: string;
  private toolRegistry!: ToolRegistry;
  private executionPipeline!: ExecutionPipeline;

  /** Stable session ID reused across all chat() calls — enables cross-session memory */
  private agentSessionId!: string;

  /**
   * 
   */
  private constructor(config: AgentConfig, options: AgentOptions = {}) {
    this.config = config;
    this.runtimeOptions = options;
    this.systemPrompt = '';
  }

  /**
   * 
   * 
   */
  static async create(
    config: AgentConfig,
    options: AgentOptions = {}
  ): Promise<Agent> {
    if (!config.apiKey) {
      throw new Error('❌ API Key ');
    }
    const agent = new Agent(config, options);
    await agent.initialize();

    return agent;
  }

  /**
   * 
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const promptResult = await buildSystemPrompt({
        projectPath: process.cwd(),
        replaceDefault: this.config.systemPrompt,
        includeEnvironment: true,
      });
      this.systemPrompt = promptResult.prompt;
      this.chatService = createChatService({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        model: this.config.model,
      });
      this.toolRegistry = createToolRegistry();
      const builtinTools = getBuiltinTools();
      for (const tool of builtinTools) {
        this.toolRegistry.register(tool);
      }
      if (configManager.isMcpEnabled()) {
        await this.registerMcpTools();
      }
      const permissionConfig = configManager.getPermissionConfig();
      const defaultMode = configManager.getDefaultPermissionMode() as 'default' | 'autoEdit' | 'yolo' | 'plan';
      
      this.executionPipeline = new ExecutionPipeline(this.toolRegistry, {
        permissions: permissionConfig,
        defaultMode: this.mapPermissionMode(defaultMode),
      });

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Agent : ${error instanceof Error ? error.message : ''}`
      );
    }
  }

  /**
   * 
   * 
   */
  async chat(
    message: string,
    context?: ChatContext,
    options?: LoopOptions
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Agent ， Agent.create() ');
    }
    // Use stable session ID for cross-session memory
    const sessionId = context?.sessionId || this.agentSessionId || `session-${Date.now()}`;
    this.agentSessionId = sessionId;
    const ctx: ChatContext = context || {
      sessionId,
      messages: [],
    };
    const result = await this.executeLoop(message, ctx, options);

    if (!result.success) {
      if (result.error?.type === 'aborted') {
        return '';
      }
      throw new Error(result.error?.message || '');
    }

    return result.finalMessage || '';
  }

  /**
   * 
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * 
   * 
   * 
   */
  private async executeLoop(
    message: string,
    context: ChatContext,
    options?: LoopOptions
  ): Promise<LoopResult> {
    const messages: Message[] = [];
    // Begränsad memory för lokala modeller
    const isLocal = (this.config.baseURL || '').includes('11434');
    const memCtx = await sharedMemory.buildContext(message, isLocal ? 2 : 4, context.sessionId || 'default');
    const fullSystem = memCtx
      ? this.systemPrompt + '\n\n' + memCtx
      : this.systemPrompt;
    messages.push({ role: 'system', content: fullSystem });
    messages.push(...context.messages);
    // Append language hint to user message
    const langHint = /[\u4e00-\u9fff]/.test(message) ? ' (respond in Chinese)' :
                     /[\u00c0-\u017e\u00e0-\u00ff]/.test(message) ? ' (respond in the same language)' :
                     ' (respond in English)';
    messages.push({ role: 'user', content: message + langHint });
    if (sharedMemory.isEnabled()) {
      sharedMemory.add(message, 'aegis-cli', context.sessionId || 'default', [], 'user', true).catch(() => {});
    }
    const configuredMaxTurns =
      this.runtimeOptions.maxTurns ??
      options?.maxTurns ??
      this.config.maxTurns ??
      -1;
    if (configuredMaxTurns === 0) {
      return {
        success: false,
        error: { type: 'chat_disabled', message: '' },
      };
    }
    const maxTurns = configuredMaxTurns === -1
      ? TURN_LIMIT
      : Math.min(configuredMaxTurns, TURN_LIMIT);

    let turnsCount = 0;
    let recentRetries = 0;
    let consecutiveToolFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const allToolResults: ToolResult[] = [];
    const mode = context.permissionMode === 'plan' ? 'plan' : undefined;
    const functionDeclarations = this.toolRegistry.getFunctionDeclarationsByMode(mode);
    const tools: ToolDefinition[] = functionDeclarations.map(fn => ({
      type: 'function' as const,
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters as ToolDefinition['function']['parameters'],
      },
    }));
    while (true) {
      if (options?.signal?.aborted) {
        return { success: false, error: { type: 'aborted' } };
      }
      // await this.checkAndCompact(context, turnsCount);
      turnsCount++;
      options?.onTurnStart?.({ turn: turnsCount, maxTurns });
      const streamCallbacks: StreamCallbacks = {
        onContentDelta: options?.onContentDelta,
        onThinkingDelta: options?.onThinkingDelta,
      };
      let turnResult;
      try {
        turnResult = await this.chatService.chat(
          messages,
          tools.length > 0 ? tools : undefined,
          options?.signal,
          streamCallbacks
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return { success: false, error: { type: 'aborted' } };
        }
        return {
          success: false,
          error: {
            type: 'llm_error',
            message: error instanceof Error ? error.message : 'LLM ',
            cause: error instanceof Error ? error : undefined,
          },
        };
      }
      if (turnResult.content && options?.onContent) {
        options.onContent(turnResult.content);
      }
      if (turnResult.reasoningContent && options?.onThinking) {
        options.onThinking(turnResult.reasoningContent);
      }
      if (!turnResult.toolCalls || turnResult.toolCalls.length === 0) {
        if (this.detectIncompleteIntent(turnResult.content) && recentRetries < 2) {
          recentRetries++;
          messages.push({
            role: 'user',
            content: '，。',
          });
          continue;
        }
        const shouldContinue = await onStop(
          'end_turn',
          context.sessionId || 'unknown',
          process.cwd()
        );

        if (shouldContinue) {
          agentDebug.log('Stop hook requested to continue');
          messages.push({
            role: 'user',
            content: '[System] Hook requested continuation. Please continue.',
          });
          continue;
        }

        if (sharedMemory.isEnabled() && turnResult.content && turnResult.content.length > 50) {
          sharedMemory.add(turnResult.content, 'aegis-cli', context.sessionId || 'default', [], 'assistant', true).catch(() => {});
          if (context.sessionId) {
            syncSessionToDrive(context.sessionId).catch(() => {});
            sharedMemory.summarizeAndStoreSession(
              context.sessionId,
              this.config.apiKey,
              this.config.baseURL,
              this.config.model
            ).catch(() => {});
          }
        }
        return {
          success: true,
          finalMessage: turnResult.content,
          metadata: {
            turnsCount,
            toolCallsCount: allToolResults.length,
            totalTokens: turnResult.usage?.totalTokens,
          },
        };
      }
      recentRetries = 0;
      const assistantMsg: any = {
        role: 'assistant',
        content: turnResult.content || '',
        tool_calls: turnResult.toolCalls,
      };
      if (turnResult.reasoningContent) {
        assistantMsg.reasoning_content = turnResult.reasoningContent;
      }
      messages.push(assistantMsg);
      let turnHasFailure = false;
      for (const toolCall of turnResult.toolCalls) {
        if (toolCall.type !== 'function') continue;
        if (options?.signal?.aborted) {
          return { success: false, error: { type: 'aborted' } };
        }
        options?.onToolCallStart?.(toolCall);
        const result = await this.executeToolCall(toolCall, context);
        allToolResults.push(result);
        options?.onToolResult?.(toolCall, result);
        if (!result.success && result.error?.includes('User rejected')) {
          return {
            success: true,
            metadata: {
              turnsCount,
              toolCallsCount: allToolResults.length,
            },
          };
        }

        if (!result.success) turnHasFailure = true;
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result.llmContent || result.displayContent || '',
        });
      }
      if (turnHasFailure) {
        consecutiveToolFailures++;
        if (consecutiveToolFailures >= MAX_CONSECUTIVE_FAILURES) {
          messages.push({
            role: 'user',
            content: '[System] Multiple consecutive tool failures detected. Please stop retrying and explain the issue to the user.',
          });
        }
      } else {
        consecutiveToolFailures = 0;
      }
      if (turnsCount >= maxTurns) {
        if (options?.onTurnLimitReached) {
          const response = await options.onTurnLimitReached({ turnsCount });
          if (response.continue) {
            turnsCount = 0;
            continue;
          }
        }
        return {
          success: false,
          error: {
            type: 'max_turns_exceeded',
            message: ` (${maxTurns})`,
          },
          metadata: {
            turnsCount,
            toolCallsCount: allToolResults.length,
          },
        };
      }
    }
  }

  /**
   * 
   */
  private detectIncompleteIntent(content: string | undefined): boolean {
    if (!content) return false;
    return INCOMPLETE_INTENT_PATTERNS.some(pattern => pattern.test(content));
  }

  /**
   * 
   * 
   * 
   */
  private async executeToolCall(
    toolCall: ToolCall,
    context: ChatContext
  ): Promise<ToolResult> {
    let params: Record<string, unknown>;
    try {
      params = JSON.parse(toolCall.function.arguments);
    } catch {
      return {
        success: false,
        error: `Invalid tool arguments: ${toolCall.function.arguments}`,
        displayContent: `❌ Invalid arguments for ${toolCall.function.name}`,
        llmContent: `Error: Failed to parse tool arguments as JSON.`,
      };
    }
    const pipelineContext: PipelineExecutionContext = {
      sessionId: context.sessionId,
      workspaceRoot: process.cwd(),
      permissionMode: this.mapPermissionMode(context.permissionMode),
      signal: context.signal,
      confirmationHandler: context.confirmationHandler,
      messageId: toolCall.id,
    };
    const result = await this.executionPipeline.execute(
      toolCall.function.name,
      params,
      pipelineContext
    );
    return {
      success: result.success,
      displayContent: result.displayContent,
      llmContent: result.llmContent,
      error: result.error?.message,
      metadata: result.metadata,
    };
  }

  /**
   * 
   */
  private mapPermissionMode(mode?: string): PermissionMode {
    switch (mode) {
      case 'autoEdit':
        return PermissionMode.AUTO_EDIT;
      case 'yolo':
        return PermissionMode.YOLO;
      case 'plan':
        return PermissionMode.PLAN;
      default:
        return PermissionMode.DEFAULT;
    }
  }

  /**
   * 
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * 
   */
  getExecutionPipeline(): ExecutionPipeline {
    return this.executionPipeline;
  }

  /**
   * 
   * 
   * 
   */
  private async registerMcpTools(): Promise<void> {
    try {
      const mcpServers = configManager.getMcpServers();
      
      if (Object.keys(mcpServers).length === 0) {
        return;
      }

      agentDebug.log(` MCP  (${Object.keys(mcpServers).length} )...`);
      const registry = McpRegistry.getInstance();
      await registry.registerServers(mcpServers);
      const mcpTools = await registry.getAvailableTools();
      
      if (mcpTools.length > 0) {
        for (const tool of mcpTools) {
          try {
            this.toolRegistry.register(tool);
          } catch (error) {
            agentDebug.warn(` MCP  "${tool.name}" :`, (error as Error).message);
          }
        }
        agentDebug.log(` ${mcpTools.length}  MCP `);
      }
      registry.removeAllListeners('toolsUpdated');
      registry.on('toolsUpdated', async () => {
        agentDebug.log('MCP ');
      });

    } catch (error) {
      agentDebug.warn('MCP :', (error as Error).message);
    }
  }
}

export default Agent;
