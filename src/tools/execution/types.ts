/**
 * 
 */

import type { Tool, ToolResult, ToolInvocation } from '../types.js';

// ========== 权限模

/**
 * 
 */
export enum PermissionMode {
  /** 默认模式：写操作需确认 */
  DEFAULT = 'default',
  /** 自动批准编辑 */
  AUTO_EDIT = 'autoEdit',
  /** 自动批准所有 */
  YOLO = 'yolo',
  /** 只读调研模式 */
  PLAN = 'plan',
}

// ========== 权限检

/**
 * 
 */
export enum PermissionResult {
  ALLOW = 'allow',
  ASK = 'ask',
  DENY = 'deny',
}

/**
 * 
 */
export interface PermissionCheckResult {
  result: PermissionResult;
  matchedRule?: string;
  reason?: string;
}

/**
 * 
 */
export interface PermissionConfig {
  allow: string[];
  deny: string[];
  ask: string[];
}

/**
 * 
 */
export interface ToolInvocationDescriptor {
  toolName: string;
  params: Record<string, unknown>;
  affectedPaths?: string[];
  tool?: Tool;
}

// ========== 确认机

/**
 * 
 */
export interface ConfirmationDetails {
  title: string;
  message: string;
  details?: string;
  risks?: string[];
  affectedFiles?: string[];
}

/**
 * 
 */
export interface ConfirmationResponse {
  approved: boolean;
  reason?: string;
  scope?: 'once' | 'session';
}

/**
 * 
 */
export interface ConfirmationHandler {
  requestConfirmation(details: ConfirmationDetails): Promise<ConfirmationResponse>;
}

// ========== 执行上下

/**
 * 
 */
export interface PipelineExecutionContext {
  sessionId: string;
  workspaceRoot: string;
  permissionMode: PermissionMode;
  signal?: AbortSignal;
  onProgress?: (progress: ToolProgress) => void;
  confirmationHandler?: ConfirmationHandler;
  messageId?: string;
}

/**
 * 
 */
export interface ToolProgress {
  stage: string;
  message: string;
  percent?: number;
}

// ========== 工具执

/**
 * 
 */
export interface ToolExecutionInternal {
  tool?: Tool;
  invocation?: ToolInvocation;
  needsConfirmation?: boolean;
  confirmationReason?: string;
  permissionSignature?: string;
  hookToolUseId?: string;
}

/**
 * 
 */
export class ToolExecution {
  private result?: ToolResult;
  private aborted = false;
  private abortReason?: string;

  readonly _internal: ToolExecutionInternal = {};

  constructor(
    public readonly toolName: string,
    public params: Record<string, unknown>,
    public readonly context: PipelineExecutionContext
  ) {}

  /**
   * 
   */
  abort(reason: string): void {
    this.aborted = true;
    this.abortReason = reason;
  }

  /**
   * 
   */
  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * 
   */
  getAbortReason(): string | undefined {
    return this.abortReason;
  }

  /**
   * 
   */
  setResult(result: ToolResult): void {
    this.result = result;
  }

  /**
   * 
   */
  getResult(): ToolResult | undefined {
    return this.result;
  }
}

// ========== 管道阶

/**
 * 
 */
export interface PipelineStage {
  readonly name: string;
  process(execution: ToolExecution): Promise<void>;
}

// ========== 管道配

/**
 * 
 */
export interface ExecutionPipelineConfig {
  permissions?: PermissionConfig;
  defaultMode?: PermissionMode;
  /** Per-model allowed tools — overrides global whitelist for the current model */
  allowedTools?: string[];
  /** Per-model disallowed tools — overrides global blacklist for the current model */
  disallowedTools?: string[];
}

// ========== 执行历

/**
 * 
 */
export interface ExecutionHistoryEntry {
  toolName: string;
  params: Record<string, unknown>;
  result: ToolResult;
  timestamp: number;
  duration: number;
  permissionMode: PermissionMode;
  stages: string[];
}

// ========== Hook 相

/**
 * Pre-Tool Hook 结果
 */
export interface PreToolHookResult {
  decision: 'allow' | 'ask' | 'deny';
  modifiedInput?: Record<string, unknown>;
  reason?: string;
  warning?: string;
}

/**
 * Post-Tool Hook 参数
 */
export interface PostToolHookParams {
  toolName: string;
  params: Record<string, unknown>;
  result?: ToolResult;
  context: PipelineExecutionContext;
}

// ========== 管道事

/**
 * 
 */
export interface StageStartEvent {
  stage: string;
  execution: ToolExecution;
}

/**
 * 
 */
export interface StageCompleteEvent {
  stage: string;
  execution: ToolExecution;
}
