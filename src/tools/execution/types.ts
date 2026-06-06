/**
 * 
 */

import type { Tool, ToolResult, ToolInvocation } from '../types.js';

/**
 * 
 */
export enum PermissionMode {
  
  DEFAULT = 'default',
  
  AUTO_EDIT = 'autoEdit',
  
  YOLO = 'yolo',
  
  PLAN = 'plan',
}

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

/**
 * 
 */
export interface PipelineStage {
  readonly name: string;
  process(execution: ToolExecution): Promise<void>;
}

/**
 * 
 */
export interface ExecutionPipelineConfig {
  permissions?: PermissionConfig;
  defaultMode?: PermissionMode;
}

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

/**
 */
export interface PreToolHookResult {
  decision: 'allow' | 'ask' | 'deny';
  modifiedInput?: Record<string, unknown>;
  reason?: string;
  warning?: string;
}

/**
 */
export interface PostToolHookParams {
  toolName: string;
  params: Record<string, unknown>;
  result?: ToolResult;
  context: PipelineExecutionContext;
}

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
