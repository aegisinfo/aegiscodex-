/**
 *
 */
import type { Tool, ToolResult, ToolInvocation } from '../types.js';
/**
 *
 */
export declare enum PermissionMode {
    /** 默认模式：写操作需确认 */
    DEFAULT = "default",
    /** 自动批准编辑 */
    AUTO_EDIT = "autoEdit",
    /** 自动批准所有 */
    YOLO = "yolo",
    /** 只读调研模式 */
    PLAN = "plan"
}
/**
 *
 */
export declare enum PermissionResult {
    ALLOW = "allow",
    ASK = "ask",
    DENY = "deny"
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
export declare class ToolExecution {
    readonly toolName: string;
    params: Record<string, unknown>;
    readonly context: PipelineExecutionContext;
    private result?;
    private aborted;
    private abortReason?;
    readonly _internal: ToolExecutionInternal;
    constructor(toolName: string, params: Record<string, unknown>, context: PipelineExecutionContext);
    /**
     *
     */
    abort(reason: string): void;
    /**
     *
     */
    isAborted(): boolean;
    /**
     *
     */
    getAbortReason(): string | undefined;
    /**
     *
     */
    setResult(result: ToolResult): void;
    /**
     *
     */
    getResult(): ToolResult | undefined;
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
//# sourceMappingURL=types.d.ts.map