/**
 * 
 * 
 */

import type { PermissionMode } from '../agent/types.js';

/**
 * 
 */
export enum HookEvent {
  
  PreToolUse = 'PreToolUse',
  
  PostToolUse = 'PostToolUse',
  
  PostToolUseFailure = 'PostToolUseFailure',
  
  PermissionRequest = 'PermissionRequest',
  
  UserPromptSubmit = 'UserPromptSubmit',
  
  SessionStart = 'SessionStart',
  
  SessionEnd = 'SessionEnd',
  
  Stop = 'Stop',
  
  SubagentStop = 'SubagentStop',
  
  Notification = 'Notification',
  
  Compaction = 'Compaction',
}

export enum HookExitCode {
  
  SUCCESS = 0,
  
  NON_BLOCKING_ERROR = 1,
  
  BLOCKING_ERROR = 2,
  
  TIMEOUT = 124,
}

/**
 */
export interface HookConfig {
  
  enabled?: boolean;
  
  defaultTimeout?: number;
  
  timeoutBehavior?: 'ignore' | 'deny' | 'ask';
  
  failureBehavior?: 'ignore' | 'deny' | 'ask';
  
  maxConcurrentHooks?: number;
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  PostToolUseFailure?: HookMatcher[];
  PermissionRequest?: HookMatcher[];
  UserPromptSubmit?: HookMatcher[];
  SessionStart?: HookMatcher[];
  SessionEnd?: HookMatcher[];
  Stop?: HookMatcher[];
  SubagentStop?: HookMatcher[];
  Notification?: HookMatcher[];
  Compaction?: HookMatcher[];
}

/**
 */
export interface HookMatcher {
  
  name?: string;
  
  matcher?: MatcherConfig;
  
  hooks: Hook[];
}

/**
 * 
 */
export interface MatcherConfig {
  
  tools?: string;
  
  paths?: string;
  
  commands?: string;
}

/**
 */
export type Hook = CommandHook;

/**
 * 
 */
export interface CommandHook {
  type: 'command';
  
  command: string;
  
  timeout?: number;
  
  statusMessage?: string;
}

/**
 */
export interface HookInputBase {
  hook_event_name: HookEvent;
  hook_execution_id: string;
  timestamp: string;
  session_id: string;
  project_dir: string;
}

/**
 */
export interface PreToolUseInput extends HookInputBase {
  hook_event_name: HookEvent.PreToolUse;
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
  permission_mode: PermissionMode;
}

/**
 */
export interface PostToolUseInput extends HookInputBase {
  hook_event_name: HookEvent.PostToolUse;
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
  tool_output: unknown;
}

/**
 */
export interface PostToolUseFailureInput extends HookInputBase {
  hook_event_name: HookEvent.PostToolUseFailure;
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
  error: string;
}

/**
 */
export interface PermissionRequestInput extends HookInputBase {
  hook_event_name: HookEvent.PermissionRequest;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

/**
 */
export interface UserPromptSubmitInput extends HookInputBase {
  hook_event_name: HookEvent.UserPromptSubmit;
  prompt_content: string;
}

/**
 */
export interface SessionStartInput extends HookInputBase {
  hook_event_name: HookEvent.SessionStart;
}

/**
 */
export interface SessionEndInput extends HookInputBase {
  hook_event_name: HookEvent.SessionEnd;
}

/**
 */
export interface StopInput extends HookInputBase {
  hook_event_name: HookEvent.Stop;
  stop_reason?: string;
}

/**
 */
export interface SubagentStopInput extends HookInputBase {
  hook_event_name: HookEvent.SubagentStop;
  subagent_id: string;
  stop_reason?: string;
}

/**
 */
export interface NotificationInput extends HookInputBase {
  hook_event_name: HookEvent.Notification;
  message: string;
  level: 'info' | 'warning' | 'error';
}

/**
 */
export interface CompactionInput extends HookInputBase {
  hook_event_name: HookEvent.Compaction;
  pre_tokens: number;
  message_count: number;
}

export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | PostToolUseFailureInput
  | PermissionRequestInput
  | UserPromptSubmitInput
  | SessionStartInput
  | SessionEndInput
  | StopInput
  | SubagentStopInput
  | NotificationInput
  | CompactionInput;

/**
 */
export interface PreToolUseOutput {
  hookEventName?: 'PreToolUse';
  
  permissionDecision?: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  
  updatedInput?: Record<string, unknown>;
}

/**
 */
export interface PostToolUseOutput {
  hookEventName?: 'PostToolUse';
  
  additionalContext?: string;
  
  updatedOutput?: unknown;
}

/**
 */
export interface PermissionRequestOutput {
  
  decision?: 'approve' | 'deny' | 'ask';
  reason?: string;
}

/**
 */
export interface StopOutput {
  
  continue?: boolean;
  reason?: string;
}

/**
 */
export interface CompactionOutput {
  
  prevent?: boolean;
  reason?: string;
}

export type HookSpecificOutput =
  | PreToolUseOutput
  | PostToolUseOutput
  | PermissionRequestOutput
  | StopOutput
  | CompactionOutput;

/**
 */
export interface HookContext {
  sessionId: string;
  projectDir: string;
  permissionMode: PermissionMode;
}

/**
 */
export interface HookExecutionContext extends HookContext {
  config: HookConfig;
}

/**
 * 
 */
export interface HookExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  output?: {
    hookSpecificOutput?: HookSpecificOutput;
    rawOutput?: string;
  };
  error?: string;
  blocking?: boolean;
  needsConfirmation?: boolean;
  warning?: string;
}

/**
 */
export interface PreToolHookResult {
  decision: 'allow' | 'deny' | 'ask';
  reason?: string;
  modifiedInput?: Record<string, unknown>;
  warning?: string;
}

/**
 */
export interface PostToolHookResult {
  additionalContext?: string;
  modifiedOutput?: unknown;
}

/**
 */
export interface PermissionHookResult {
  decision: 'approve' | 'deny' | 'ask';
  reason?: string;
}

/**
 */
export interface StopHookResult {
  shouldContinue: boolean;
  reason?: string;
}

/**
 */
export interface UserPromptHookResult {
  injectedContext?: string;
}

/**
 */
export interface CompactionHookResult {
  shouldPrevent: boolean;
  reason?: string;
}

/**
 * 
 */
export interface MatchContext {
  toolName?: string;
  filePath?: string;
  command?: string;
}

export const DEFAULT_HOOK_CONFIG: HookConfig = {
  enabled: true,
  defaultTimeout: 60,
  timeoutBehavior: 'ignore',
  failureBehavior: 'ignore',
  maxConcurrentHooks: 5,
};
