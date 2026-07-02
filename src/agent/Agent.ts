/**
 * Agent 核心类 - 无状态设计
 * 
 * 
 * 1. Agent 本身不保存任何会话状态（sessionId, messages 等）
 * 2. 所有状态通过 context 参数传入
 * 3. Agent 实例可以每次命令创建，用完即弃
 * 4. 历史连续性由外部 SessionContext 保证
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
import { LOCAL_SYSTEM_PROMPT } from '../prompts/default.js';
import { isLocalOllamaUrl } from '../services/OllamaInstaller.js';
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
import { sharedMemory, setOllamaBaseUrl } from '../memory/SharedMemory.js';
import { syncSessionToDrive } from '../memory/DriveSync.js';
import { ensureOllama } from '../services/OllamaInstaller.js';
import { TokenCounter } from '../context/TokenCounter.js';
import { CompactionService, betterment } from '../context/index.js';
import { trackInteraction } from '../services/Heartbeat.js';
import { extractLearning, pushLearnings } from '../services/LearningCollector.js';
import type { Learning } from '../services/LearningCollector.js';
import { recordCost, startCostLedger } from '../services/CostLedger.js';

// Buffer of extracted learnings awaiting a cloud push
const pendingLearnings: Learning[] = [];

// Flush remaining learnings on process exit (best-effort)
process.once('beforeExit', () => {
  if (pendingLearnings.length > 0) {
    void pushLearnings(pendingLearnings.splice(0));
  }
});
import fs from 'fs/promises';

// ========== Hallucination logger ===

/** Hallucination log path — written as JSONL in debug mode so the dev can grep patterns. */
const HALLUCINATION_LOG_PATH = process.env.AEGIS_HALLUCINATION_LOG || '';

interface HallucinationLogEntry {
  ts: string;
  sessionId: string;
  family: HallucinationFamily;
  snippet: string;       // first 200 chars of the matched text
  model: string;
  turn: number;
}

function writeHallucinationLog(entry: HallucinationLogEntry): void {
  if (!HALLUCINATION_LOG_PATH) return;
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(HALLUCINATION_LOG_PATH, line, 'utf-8').catch(() => {});
}

function logHallucination(
  families: HallucinationFamily[],
  content: string,
  sessionId: string,
  model: string,
  turn: number,
): void {
  for (const family of families) {
    agentDebug.warn(`[Hallucination] ${family} detected (turn ${turn}, model ${model})`);
    writeHallucinationLog({
      ts: new Date().toISOString(),
      sessionId,
      family,
      snippet: content.slice(0, 200).replace(/\n/g, '\\n'),
      model,
      turn,
    });
  }
}

/** 轮次上限（Infinity = 无限制） */
const TURN_LIMIT = Infinity;

/** 意图未完成检测模式 */
const INCOMPLETE_INTENT_PATTERNS = [
  /：\s*$/,                           // 中文冒号结
  /:\s*$/,                            // 英文冒号结
  /\.\.\.\s*$/,                       // 省略号结
  /让我(先|来|开始|查看|检查|修复)/,    // 中文意图
  /Let me (first|start|check|look|fix)/i,  // 英文意图
];

/**
 * Hallucination detection — multi-pattern matcher for known false-claim families.
 *
 * All patterns here target responses *without* tool calls. If the model actually
 * issues the tool call, the action is real regardless of accompanying text.
 *
 * Pattern families:
 *   1. Permission-dialog hallucination ("click Allow", "approve the prompt")
 *   2. Sandbox/workspace boundary hallucination ("scoped to X", "can only access Y")
 *   3. False config-file hallucination ("~/.claude/settings.json has sandbox disabled")
 *   4. False tool-capability hallucination ("I can't read outside the project")
 */
const HALLUCINATED_PERMISSION_BLOCK_PATTERN = new RegExp(
  // Family 1: Permission-dialog hallucination
  '\\b(permission|approv\\w*)\\b[^\\n]{0,150}\\b(blocked|stuck|denied|approve|dialog|click|allow|grant|settings\\.json|prompted)\\b' +
  '|\\b(blocked|stuck|denied)\\b[^\\n]{0,150}\\b(permission|approv\\w*)\\b' +
  '|click\\s+(\\*\\*)?Allow(\\*\\*)?\\b' +
  // Family 2: Sandbox/workspace boundary hallucination
  '|\\b(sandbox\\w*|confine\\w*|restrict\\w*)\\b[^\\n]{0,80}\\b(session|director|workspace|project|path|access|scope|limit)\\b' +
  '|\\b(session|workspace|project)\\b[^\\n]{0,80}\\b(sandbox\\w*|confine\\w*|restrict\\w*)\\b' +
  '|\\b(scop\\w*|limit\\w*)\\b[^\\n]{0,60}\\b(tool|read|write|edit|access)\\b[^\\n]{0,60}\\b(director|project|workspace|path)\\b',
  'i'
);

/** Family 3: False config/settings claims — e.g. "~/.claude/settings.json disables sandbox" */
const HALLUCINATED_CONFIG_PATTERN = new RegExp(
  // Unverified claims about ~/.claude/settings.json or similar
  '~[/\\\\]\\.claude[/\\\\]settings\\.json' +
  '|\\.claude\\b[^\\n]{0,80}\\bsettings\\.json\\b' +
  '|(settings\\.json|claude_desktop_config\\.json)\\b[^\\n]{0,80}\\b(sandbox\\w*|restrict\\w*|enabl\\w*|disabl\\w*|false|true)\\b' +
  '|\\b(sandbox|scope|restrict)\\w*\\b[^\\n]{0,80}\\b(false|disabled|enabled|off|on)\\b' +
  // Cursor/Windsurf/Sonnet-specific config hallucinations
  '\\b(cursor|windsurf|sonnet)\\b[^\\n]{0,60}\\b(sandbox|restrict|confine)\\w*\\b',
  'i'
);

/** Family 4: False tool-capability denial — "I can't/am not able to access that" */
const HALLUCINATED_DENIAL_PATTERN = new RegExp(
  '\\b(I|my|tools?)\\b[^\\n]{0,40}\\b(can\'t|cannot|not able|unable|don\'t have access|no access|restricted from)\\b' +
  '[^\\n]{0,80}\\b(path|file|director|home|desktop|outside|system|config|tool)\\b' +
  '|\\b(path|file|director|access|tool)\\b[^\\n]{0,40}\\b(limited|restricted|scoped|confined)\\b[^\\n]{0,40}\\b(current|project|workspace|director)\\b',
  'i'
);

/**
 * Classify a detected hallucination by family for logging and stats.
 */
type HallucinationFamily = 'permission_dialog' | 'sandbox_boundary' | 'false_config' | 'tool_denial';
function classifyHallucination(content: string): HallucinationFamily[] {
  const families: HallucinationFamily[] = [];
  if (/click\s+(\*\*)?Allow(\*\*)?\b|permission[^]{0,150}block|blocked[^]{0,150}permission/i.test(content))
    families.push('permission_dialog');
  if (/\b(sandbox|confine|restrict)\w*[^]{0,80}\b(session|workspace|project)\b/i.test(content))
    families.push('sandbox_boundary');
  if (/~\/\.claude|settings\.json[^]{0,80}(sandbox|false|disabled)/i.test(content))
    families.push('false_config');
  if (/\b(can't|cannot|unable)[^]{0,80}\b(access|read|write|path)[^]{0,80}\b(outside|desktop|home)\b/i.test(content))
    families.push('tool_denial');
  return families;
}

// ========== Agent 

export class Agent {
  // 配置（只
  private config: AgentConfig;
  private runtimeOptions: AgentOptions;

  // 初始化状
  private isInitialized = false;

  // 核心组
  private chatService!: IChatService;
  private systemPrompt: string;
  
  // 工具系
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
    this.systemPrompt = ''; // 在 initialize() 中构
  }

  // ========== 静态工厂方

  /**
   * 
   * 
   * @param config Agent 配置
   * @param options 运行时选项
   */
  static async create(
    config: AgentConfig,
    options: AgentOptions = {}
  ): Promise<Agent> {
    // 验证配
    if (!config.apiKey) {
      throw new Error('❌ API Key 未配置');
    }

    // 创建并初始
    const agent = new Agent(config, options);
    await agent.initialize();

    return agent;
  }

  // ========== 初始

  /**
   * 
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1. 构建系统提示词（使用四层架
      if (isLocalOllamaUrl(this.config.baseURL)) {
        this.systemPrompt = LOCAL_SYSTEM_PROMPT;
      } else {
        const promptResult = await buildSystemPrompt({
          projectPath: process.cwd(),
          replaceDefault: this.config.systemPrompt,
          includeEnvironment: true,
        });
        this.systemPrompt = promptResult.prompt;
      }

      // 2. 创
      const defaultPermissionMode = configManager.getDefaultPermissionMode();
      const thinkingBudget = configManager.getThinkingBudget();
      this.chatService = createChatService({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        model: this.config.model,
        permissionMode: defaultPermissionMode,
        thinkingBudget,
        maxOutputTokens: this.config.maxOutputTokens,
      });

      // Set Ollama base URL for cross-semantic memory embeddings
      setOllamaBaseUrl(this.config.baseURL);

      // Auto-install / start Ollama; may return a different model if the
      // requested one doesn't support tools (e.g. bare "llama3" → "llama3.2")
      const resolvedModel = await ensureOllama(this.config.baseURL, this.config.model);
      if (resolvedModel && resolvedModel !== this.config.model) {
        this.config.model = resolvedModel;
        // Rebuild chat service with the corrected model
        this.chatService = createChatService({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
          model: this.config.model,
          permissionMode: defaultPermissionMode,
          thinkingBudget,
          maxOutputTokens: this.config.maxOutputTokens,
        });
      }

      // 3. 初始化工具系
      this.toolRegistry = createToolRegistry();
      
      // 注册内置工
      const builtinTools = getBuiltinTools();
      for (const tool of builtinTools) {
        this.toolRegistry.register(tool);
      }

      // 4. 注册 MCP 工具（如果启
      if (configManager.isMcpEnabled()) {
        await this.registerMcpTools();
      }

      // 5. 创建执行管道（使用 settings.json 中的权限配 + 模型级工具过滤
      const permissionConfig = configManager.getPermissionConfig();
      const defaultMode = defaultPermissionMode as 'default' | 'autoEdit' | 'yolo' | 'plan';

      // Hämta modellspecifika verktygsbegränsningar
      const modelRestrictions = configManager.getModelToolRestrictions(this.config.model);

      this.executionPipeline = new ExecutionPipeline(this.toolRegistry, {
        permissions: permissionConfig,
        defaultMode: this.mapPermissionMode(defaultMode),
        allowedTools: modelRestrictions.allowedTools,
        disallowedTools: modelRestrictions.disallowedTools,
      });

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Agent 初始化失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  // ========== 公共方

  /** Expose chat service so callers (e.g. auto-compact) can use the configured LLM. */
  getChatService(): IChatService {
    return this.chatService;
  }

  /**
   *
   *
   * @param message 用户消息
   * @param context 聊天上下文（包含历史消息、sessionId 等）
   * @param options 循环选项
   */
  async chat(
    message: string,
    context?: ChatContext,
    options?: LoopOptions
  ): Promise<string> {
    const result = await this.chatWithMetadata(message, context, options);

    if (!result.success) {
      if (result.error?.type === 'aborted') {
        return ''; // 用户中
      }
      throw new Error(result.error?.message || '执行失败');
    }

    return result.finalMessage || '';
  }

  /**
   * Same as chat(), but returns the full LoopResult (turn/tool-call counts,
   * token totals) instead of just the final text — used by headless callers
   * like --print --output-format json that need to report usage.
   */
  async chatWithMetadata(
    message: string,
    context?: ChatContext,
    options?: LoopOptions
  ): Promise<LoopResult> {
    if (!this.isInitialized) {
      throw new Error('Agent 未初始化，请使用 Agent.create() 创建实例');
    }
    // Use stable session ID for cross-session memory
    const sessionId = context?.sessionId || this.agentSessionId || `session-${Date.now()}`;
    this.agentSessionId = sessionId;
    const ctx: ChatContext = context || {
      sessionId,
      messages: [],
    };

    return this.executeLoop(message, ctx, options);
  }

  /**
   * 
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Update requireConfirmation in place so toggling /confirm takes effect
   * immediately, without waiting on an async Agent rebuild that could race
   * against the next user message.
   */
  setRequireConfirmation(value: boolean | undefined): void {
    this.config.requireConfirmation = value;
  }

  // ========== 核心执行循

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
    // === 1. 准备阶

    // 构建消息历
    const messages: Message[] = [];
    
    // 0) Auto-compact: 在截断前检查是否需要自动压缩上下文
    await this.autoCompactIfNeeded(context);

    // 添加系统提
    const isLocal = (this.config.baseURL || '').includes('11434');
    // Shared memory is NOT auto-injected here — a past session's mistakes
    // (or hallucinations) getting recalled as unconditional "context" on
    // every turn is exactly what caused models to repeat them. Memory is
    // opt-in via the Memory tool; the model calls it only when it decides
    // recalling past context would help.
    messages.push({ role: 'system', content: this.systemPrompt });
    
    // 添加历史消息（带 Token 上下文窗口截断）
    const maxTokens = this.config.maxContextTokens || 200000;
    const systemTokens = TokenCounter.countTokens([messages[0]], this.config.model || 'gpt-4o');
    const maxHistoryTokens = Math.min(maxTokens * 0.85, maxTokens - systemTokens - 5000); // 保留 15% 给 system+user+response
    const truncatedMessages = TokenCounter.truncateMessages(context.messages, this.config.model || 'gpt-4o', maxHistoryTokens);
    if (context.messages.length > truncatedMessages.length) {
      console.log(`[Agent] Context window: truncated ${context.messages.length} → ${truncatedMessages.length} messages (kept ${maxHistoryTokens.toLocaleString()} tokens)`);
    }
    messages.push(...truncatedMessages);
    
    // 添加当前用户消
    // Append language hint to user message
    const langHint = /[\u4e00-\u9fff]/.test(message) ? ' (respond in Chinese)' :
                     /[\u00c0-\u017e\u00e0-\u00ff]/.test(message) ? ' (respond in the same language)' :
                     ' (respond in English)';
    messages.push({ role: 'user', content: message + langHint });
    sharedMemory.add(message, 'aegis-cli', context.sessionId || 'default', [], 'user', true).catch(() => {});
    trackInteraction('user', message, context.sessionId, {
      model: this.config.model,
      provider: this.config.baseURL,
    });

    // === 2. 循环配

    // 计算最大轮
    const configuredMaxTurns =
      this.runtimeOptions.maxTurns ??
      options?.maxTurns ??
      this.config.maxTurns ??
      -1;

    // 特殊值处理：0 = 禁用对
    if (configuredMaxTurns === 0) {
      return {
        success: false,
        error: { type: 'chat_disabled', message: '对话功能已禁用' },
      };
    }

    // 应用安全上
    const maxTurns = configuredMaxTurns === -1
      ? TURN_LIMIT
      : Math.min(configuredMaxTurns, TURN_LIMIT);

    let turnsCount = 0;
    let recentRetries = 0;
    let consecutiveToolFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    const allToolResults: ToolResult[] = [];

    // 获取工具定
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

    // === 3. 核心循
    while (true) {
      // 3.1 检查中断信
      if (options?.signal?.aborted) {
        return { success: false, error: { type: 'aborted' } };
      }

      // 3.2 检查并压缩上下文
      // context compression will trim token usage when approaching limit
      // if (this.shouldCompact(context)) {
      //   await this.compactContext(context);
      // }

      // 3.3 轮次计
      turnsCount++;
      options?.onTurnStart?.({ turn: turnsCount, maxTurns });

      // 3.4 构建流式回调（onToolCallStart 在执行阶段单独触发，此处不
      const streamCallbacks: StreamCallbacks = {
        onStreamEvent: options?.onStreamEvent,
        onContentDelta: options?.onContentDelta,
        onThinkingDelta: options?.onThinkingDelta,
        onToolCallDelta: options?.onToolCallDelta,
      };

      // 3.5 调用 LLM（流
      let turnResult;
      try {
        turnResult = await this.chatService.chat(
          messages,
          tools.length > 0 ? tools : undefined,
          options?.signal,
          streamCallbacks
        );
      } catch (error) {
        // 处理中
        if (error instanceof Error && error.name === 'AbortError') {
          return { success: false, error: { type: 'aborted' } };
        }
        return {
          success: false,
          error: {
            type: 'llm_error',
            message: error instanceof Error ? error.message : 'LLM 调用失败',
            cause: error instanceof Error ? error : undefined,
          },
        };
      }

      // Record cost for this LLM call — fire-and-forget, never blocks
      if (turnResult.usage) {
        recordCost(
          this.config.model || 'unknown',
          turnResult.usage.promptTokens || 0,
          turnResult.usage.completionTokens || 0,
          context.sessionId,
        );
      }

      // 3.6 通知 UI 显示完整内容（非流式回调或兜
      if (turnResult.content && options?.onContent) {
        options.onContent(turnResult.content);
      }
      if (turnResult.reasoningContent && options?.onThinking) {
        options.onThinking(turnResult.reasoningContent);
      }

      // 3.6 检查是否完成（无工具调
      if (!turnResult.toolCalls || turnResult.toolCalls.length === 0) {
        // 意图未完成检 — disabled for local Ollama: the check triggers on
        // conversational replies, causing a second LLM turn whose content
        // gets streamed into the same buffer → duplicate response in the UI.
        if (!isLocal && this.detectIncompleteIntent(turnResult.content) && recentRetries < 2) {
          recentRetries++;
          messages.push({
            role: 'user',
            content: '请执行你提到的操作，不要只是描述。',
          });
          continue;
        }

        if (
          turnResult.content &&
          !isLocal &&
          (
            HALLUCINATED_PERMISSION_BLOCK_PATTERN.test(turnResult.content) ||
            HALLUCINATED_CONFIG_PATTERN.test(turnResult.content) ||
            HALLUCINATED_DENIAL_PATTERN.test(turnResult.content)
          ) &&
          recentRetries < 3
        ) {
          const families = classifyHallucination(turnResult.content);
          logHallucination(families, turnResult.content, context.sessionId || 'unknown', this.config.model || 'unknown', turnsCount);

          recentRetries++;
          messages.push({
            role: 'user',
            content: '[System] You did not make a tool call — there is nothing pending, nothing was ' +
              'denied, and there is no sandbox/workspace/config boundary restricting you to any directory. ' +
              'You just described a permission system, sandbox restriction, or configuration file setting ' +
              'that does not exist in this application. Issue the tool call now (e.g. Write/Read with the ' +
              'requested file_path); any real confirmation prompt, if one is needed, appears automatically ' +
              'the instant you call it. Do not write any more text about permissions, sandboxes, restrictions, ' +
              'or config settings — call the tool in this response.',
          });
          continue;
        }

        // 执行 Stop Hook - 允许 Hook 强制继续执
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

        // Track assistant response in admin panel
        if (turnResult.content) {
          trackInteraction('assistant', turnResult.content, context.sessionId, {
            model: this.config.model,
            provider: this.config.baseURL,
            turns: turnsCount,
            tools: allToolResults.length,
          });

          // Extract and buffer learnings from important responses
          const learning = extractLearning(turnResult.content, 'assistant', context.sessionId, this.config.model);
          if (learning) {
            pendingLearnings.push(learning);
            // Flush every 20 learnings or on session end
            if (pendingLearnings.length >= 20) {
              void pushLearnings(pendingLearnings.splice(0));
            }
          }
        }

        // Save to shared memory
        if (turnResult.content && turnResult.content.length > 50) {
          sharedMemory.add(turnResult.content, 'aegis-cli', context.sessionId || 'default', [], 'assistant', true).catch(() => {});
          if (context.sessionId) {
            syncSessionToDrive(context.sessionId).catch(() => {});
            // Auto-summarize session if it has 5+ entries
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

      // 重置重试计
      recentRetries = 0;

      // 3.7 添加 assistant 消息到历
      const assistantMsg: any = {
        role: 'assistant',
        content: turnResult.content || '',
        tool_calls: turnResult.toolCalls,
      };
      if (turnResult.reasoningContent) {
        assistantMsg.reasoning_content = turnResult.reasoningContent;
      }
      messages.push(assistantMsg);

      // 3.7.5 Compact between turns: truncate messages if they exceed the context window.
      // Tool results from Read can easily blow past the model's limit.
      {
        const modelName = this.config.model || 'gpt-4o';
        const maxTokens = this.config.maxContextTokens || 200000;
        const reserveForResponse = 10000;
        const currentTokens = TokenCounter.countTokens(messages, modelName);
        if (currentTokens > maxTokens - reserveForResponse) {
          const systemMsg = messages[0];
          const rest = messages.slice(1);
          const budget = maxTokens - reserveForResponse - TokenCounter.countTokens([systemMsg], modelName);
          const safeBudget = Math.max(budget, 1000);
          const truncated = TokenCounter.truncateMessages(rest, modelName, safeBudget);
          messages.length = 0;
          messages.push(systemMsg, ...truncated);
          console.log(`[Agent] Inter-turn compact: ${currentTokens.toLocaleString()} → ${TokenCounter.countTokens(messages, modelName).toLocaleString()} tokens`);
        }
      }

      // 3.8 执行每个工具调
      let turnHasFailure = false;
      for (const toolCall of turnResult.toolCalls) {
        if (toolCall.type !== 'function') continue;

        // 检查中
        if (options?.signal?.aborted) {
          return { success: false, error: { type: 'aborted' } };
        }

        // 通知 UI 工具调用开始（此处有完整的工具调用数
        options?.onToolCallStart?.(toolCall);

        // 执行工
        const result = await this.executeToolCall(toolCall, context);
        allToolResults.push(result);

        // 通知 UI 工具调用完
        options?.onToolResult?.(toolCall, result);

        // 用户拒绝 → 立即终止循环，不再继续思
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

        // 添加工具结果到消息历
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result.llmContent || result.displayContent || '',
        });
      }

      // 3.9 连续工具失败检测（防止无限重试循
      if (turnHasFailure) {
        consecutiveToolFailures++;
        if (consecutiveToolFailures >= MAX_CONSECUTIVE_FAILURES) {
          // 注入提示让 LLM 停止重
          messages.push({
            role: 'user',
            content: '[System] Multiple consecutive tool failures detected. Please stop retrying and explain the issue to the user.',
          });
        }
      } else {
        consecutiveToolFailures = 0;
      }

      // === 4. 轮次上限处
      if (turnsCount >= maxTurns) {
        // 询问用户是否继
        if (options?.onTurnLimitReached) {
          const response = await options.onTurnLimitReached({ turnsCount });
          if (response.continue) {
            // 用户选择继续：重置计数
            turnsCount = 0;
            continue;
          }
        }

        // 用户选择停止或非交互模
        return {
          success: false,
          error: {
            type: 'max_turns_exceeded',
            message: `达到最大轮次限制 (${maxTurns})`,
          },
          metadata: {
            turnsCount,
            toolCallsCount: allToolResults.length,
          },
        };
      }
    }
  }

  // ========== 私有方

  /** Sessions that already had an auto-compact this run (prevents repeated compaction) */
  private static autoCompactedSessions = new Set<string>();

  /**
   * Check if context messages exceed the threshold and auto-compact them.
   * Uses BettermentService for adaptive retention and prompt bias.
   * Runs at most once per session.
   */
  private async autoCompactIfNeeded(context: ChatContext): Promise<void> {
    const sessionId = context.sessionId || this.agentSessionId || 'default';
    if (!context.messages || context.messages.length < 8) return;
    if (Agent.autoCompactedSessions.has(sessionId)) return;

    const modelName = this.config.model || 'gpt-4o';
    const maxTokens = this.config.maxContextTokens || 200000;

    // Check token usage: auto-compact if over 65% of max
    const currentTokens = TokenCounter.countTokens(context.messages, modelName);
    const threshold = Math.floor(maxTokens * 0.65);
    if (currentTokens < threshold) return;

    console.log(`[Agent] Auto-compact triggered: ${currentTokens.toLocaleString()} tokens (${Math.round(currentTokens / maxTokens * 100)}% of ${maxTokens.toLocaleString()})`);

    try {
      // Use adaptive retention from BettermentService
      const adaptiveRetention = betterment.getAdaptiveRetention();
      const promptBias = betterment.getPromptBias();

      const messages = context.messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content,
      }));

      const result = await CompactionService.compact(messages, {
        modelName,
        maxContextTokens: maxTokens,
        chatService: this.chatService,
        trigger: 'auto',
        actualPreTokens: currentTokens,
      });

      // Replace context messages with compacted version
      context.messages = result.compactedMessages.map(m => ({
        role: m.role,
        content: m.content,
      })) as Message[];

      // Record in BettermentService
      betterment.recordCompaction({
        id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        trigger: 'auto',
        preTokens: result.preTokens,
        postTokens: result.postTokens,
        savedTokens: result.preTokens - result.postTokens,
        savedPercent: result.preTokens > 0
          ? Math.round((result.preTokens - result.postTokens) / result.preTokens * 100)
          : 0,
        messageCount: context.messages.length,
        retainedCount: result.compactedMessages.length,
        usedLLMSummary: !!result.summary && !result.summary.startsWith('## Conversation Summary (Auto-generated)'),
        filesIncluded: result.filesIncluded.length,
        sessionId: context.sessionId,
        projectDir: process.cwd(),
      });

      Agent.autoCompactedSessions.add(sessionId);

      const saved = result.preTokens - result.postTokens;
      console.log(`[Agent] Auto-compact done: ${result.preTokens.toLocaleString()} → ${result.postTokens.toLocaleString()} tokens (saved ${saved.toLocaleString()})`);
    } catch (error) {
      console.warn('[Agent] Auto-compact failed (non-fatal):', error instanceof Error ? error.message : String(error));
      // Auto-compact failure is non-fatal — conversation continues
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
    // 解析工具参
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

    // 构建执行上下
    const pipelineContext: PipelineExecutionContext = {
      sessionId: context.sessionId,
      workspaceRoot: process.cwd(),
      permissionMode: this.mapPermissionMode(context.permissionMode),
      signal: context.signal,
      confirmationHandler: context.confirmationHandler,
      messageId: toolCall.id,
      requireConfirmation: this.config.requireConfirmation !== false,
    };

    // 通过执行管道执行工
    const result = await this.executionPipeline.execute(
      toolCall.function.name,
      params,
      pipelineContext
    );

    // 转换为 Agent 的 ToolResult 格
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
      // 1. 获取 MCP 服务器配
      const mcpServers = configManager.getMcpServers();
      
      if (Object.keys(mcpServers).length === 0) {
        return; // 没有配置任何 MCP 服务
      }

      agentDebug.log(`正在加载 MCP 服务器 (${Object.keys(mcpServers).length} 个)...`);

      // 2. 注册并连接服务
      const registry = McpRegistry.getInstance();
      await registry.registerServers(mcpServers);

      // 3. 获取工具并注册到 Agent 的工具注册
      const mcpTools = await registry.getAvailableTools();
      
      if (mcpTools.length > 0) {
        for (const tool of mcpTools) {
          try {
            this.toolRegistry.register(tool);
          } catch (error) {
            agentDebug.warn(`注册 MCP 工具 "${tool.name}" 失败:`, (error as Error).message);
          }
        }
        agentDebug.log(`已加载 ${mcpTools.length} 个 MCP 工具`);
      }

      // 4. 监听工具更新事
      // 注意：由于 McpRegistry 是单例，需要先移除旧监听器再添加新
      // 避免每次创建 Agent 时累积监听
      registry.removeAllListeners('toolsUpdated');
      registry.on('toolsUpdated', async () => {
        try {
          const currentNames = new Set(this.toolRegistry.getMcpTools().map(t => t.name));
          const freshTools = await registry.getAvailableTools();
          const freshNames = new Set(freshTools.map(t => t.name));

          // Remove tools that disappeared
          for (const name of currentNames) {
            if (!freshNames.has(name)) this.toolRegistry.unregisterMcpTool(name);
          }

          // Register tools that are new
          for (const tool of freshTools) {
            if (!currentNames.has(tool.name)) {
              try { this.toolRegistry.registerMcpTool(tool); } catch { /* already registered */ }
            }
          }

          agentDebug.log(`MCP hot-reload: ${this.toolRegistry.mcpSize} tools active`);
        } catch (err) {
          agentDebug.warn('MCP hot-reload failed:', (err as Error).message);
        }
      });

    } catch (error) {
      agentDebug.warn('MCP 工具加载失败:', (error as Error).message);
      // MCP 加载失败不应该阻止 Agent 启
    }
  }
}

// ========== 导

export default Agent;
