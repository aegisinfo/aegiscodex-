/**
 * 
 * 
 * 
 */

import { z } from 'zod';

/**
 */
export type ProviderType = 'openai-compatible' | 'anthropic';

/**
 * 
 */
export enum PermissionMode {
  DEFAULT = 'default',
  AUTO_EDIT = 'autoEdit',
  YOLO = 'yolo',
  PLAN = 'plan',
}

// ========== Zod Schemas ==========

/**
 * 
 * 
 * 
 */
export const ModelConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  provider: z.enum(['openai-compatible', 'anthropic']).optional(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxContextTokens: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
});

/**
 * 
 */
export const PRESET_THEME_IDS = ['default', 'light', 'dark', 'ocean', 'forest', 'sunset'] as const;
export type PresetThemeId = typeof PRESET_THEME_IDS[number];

/**
 */
export const UIConfigSchema = z.object({
  theme: z.string().optional(),
});

/**
 * 
 */
export const PermissionConfigSchema = z.object({
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
  ask: z.array(z.string()).default([]),
});

/**
 */
export const McpServerConfigSchema = z.object({
  type: z.enum(['stdio', 'sse', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
  timeout: z.number().optional(),
  description: z.string().optional(),
  healthCheck: z.object({
    enabled: z.boolean(),
    intervalMs: z.number(),
    timeoutMs: z.number(),
    maxFailures: z.number(),
  }).optional(),
});

/**
 * 
 * 
 * 
 */
export const HookConfigSchema = z.object({
  enabled: z.boolean().optional(),
  defaultTimeout: z.number().optional(),
  timeoutBehavior: z.enum(['ignore', 'deny', 'ask']).optional(),
  failureBehavior: z.enum(['ignore', 'deny', 'ask']).optional(),
  maxConcurrentHooks: z.number().optional(),
  PreToolUse: z.array(z.any()).optional(),
  PostToolUse: z.array(z.any()).optional(),
  PostToolUseFailure: z.array(z.any()).optional(),
  PermissionRequest: z.array(z.any()).optional(),
  UserPromptSubmit: z.array(z.any()).optional(),
  SessionStart: z.array(z.any()).optional(),
  SessionEnd: z.array(z.any()).optional(),
  Stop: z.array(z.any()).optional(),
  SubagentStop: z.array(z.any()).optional(),
  Notification: z.array(z.any()).optional(),
  Compaction: z.array(z.any()).optional(),
}).optional();

/**
 * 
 */
export const ConfigSchema = z.object({
  // 
  default: ModelConfigSchema.optional(),
  
  // 
  models: z.array(ModelConfigSchema).optional(),
  currentModelId: z.string().optional(),
  
  // UI 
  ui: UIConfigSchema.optional(),
  theme: z.string().optional(),
  
  // 
  permissions: PermissionConfigSchema.optional(),
  
  // 
  defaultPermissionMode: z.enum(['default', 'autoEdit', 'yolo', 'plan']).optional(),
  
  // 
  toolWhitelist: z.array(z.string()).optional(),
  
  // 
  toolBlacklist: z.array(z.string()).optional(),
  
  // MCP 
  mcpServers: z.record(McpServerConfigSchema).optional(),
  
  // MCP 
  mcpEnabled: z.boolean().optional(),
  
  // Hooks 
  hooks: HookConfigSchema,
});

/**
 * 
 * 
 */
export const ClawdConfigSchema = z.object({
  default: ModelConfigSchema.optional(),
  currentModelId: z.string().optional(),
  models: z.array(ModelConfigSchema).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxContextTokens: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  stream: z.boolean().optional(),
  timeout: z.number().optional(),
  
  // UI
  ui: UIConfigSchema.optional(),
  theme: z.string().optional(),
  language: z.string().optional(),
  debug: z.union([z.string(), z.boolean()]).optional(),
  
  // MCP
  mcpEnabled: z.boolean().optional(),
  mcpServers: z.record(McpServerConfigSchema).optional(),
  permissions: PermissionConfigSchema.optional(),
  defaultPermissionMode: z.enum(['default', 'autoEdit', 'yolo', 'plan']).optional(),
  toolWhitelist: z.array(z.string()).optional(),
  toolBlacklist: z.array(z.string()).optional(),
  
  // Hooks
  hooks: HookConfigSchema,
  env: z.record(z.string()).optional(),
  maxTurns: z.number().optional(),
});

/**
 * 
 * 
 */
export const RuntimeConfigSchema = ClawdConfigSchema.extend({
  systemPrompt: z.string().optional(),
  appendSystemPrompt: z.string().optional(),
  initialMessage: z.string().optional(),
  resumeSessionId: z.string().optional(),
  forkSession: z.boolean().optional(),
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  mcpConfigPaths: z.array(z.string()).optional(),
  strictMcpConfig: z.boolean().optional(),
  fallbackModel: z.string().optional(),
  addDirs: z.array(z.string()).optional(),
  outputFormat: z.enum(['text', 'json', 'stream-json']).optional(),
  print: z.boolean().optional(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
export type PermissionConfig = z.infer<typeof PermissionConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type ClawdConfig = z.infer<typeof ClawdConfigSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type Config = ClawdConfig;

export type MergeStrategy = 'replace' | 'append-dedupe' | 'deep-merge';
export type ConfigTarget = 'config' | 'settings';
export type ConfigScope = 'local' | 'project' | 'global';

export interface FieldRouting {
  target: ConfigTarget;
  defaultScope: ConfigScope;
  mergeStrategy: MergeStrategy;
  persistable: boolean;
}

/**
 * 
 */
export const FIELD_ROUTING_TABLE: Record<string, FieldRouting> = {
  models: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  currentModelId: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  theme: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  language: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  mcpServers: { target: 'config', defaultScope: 'global', mergeStrategy: 'deep-merge', persistable: true },
  mcpEnabled: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  permissions: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: true },
  defaultPermissionMode: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: true },
  hooks: { target: 'settings', defaultScope: 'local', mergeStrategy: 'deep-merge', persistable: true },
  env: { target: 'settings', defaultScope: 'local', mergeStrategy: 'deep-merge', persistable: true },
  systemPrompt: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: false },
  appendSystemPrompt: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: false },
  initialMessage: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: false },
  resumeSessionId: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: false },
};

/**
 * 
 */
export const DEFAULT_PERMISSIONS: PermissionConfig = {
  allow: [
    'Bash(pwd)',
    'Bash(whoami)',
    'Bash(hostname)',
    'Bash(uname *)',
    'Bash(date)',
    'Bash(echo *)',
    'Bash(ls *)',
    'Bash(tree *)',
    'Bash(git status)',
    'Bash(git log *)',
    'Bash(git diff *)',
    'Bash(git branch *)',
    'Bash(npm list *)',
    'Bash(npm view *)',
    'Bash(bun *)',
  ],
  ask: [
    'Bash(curl *)',
    'Bash(wget *)',
    'Bash(rm -rf *)',
    'Bash(rm -r *)',
  ],
  deny: [
    'Read(./.env)',
    'Read(./.env.*)',
    'Bash(rm -rf /)',
    'Bash(sudo *)',
    'Bash(chmod 777 *)',
    'Bash(bash *)',
    'Bash(sh *)',
    'Bash(eval *)',
  ],
};

/**
 * 
 */
export const DEFAULT_CONFIG: ClawdConfig = {
  default: {
    model: 'claude-sonnet-4-20250514',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: '',
  },
  temperature: 0.7,
  maxContextTokens: 200000,
  maxOutputTokens: 16384,
  stream: true,
  timeout: 900000,  // 15 minutes
  ui: {
    theme: 'dark',
  },
  theme: 'dark',
  language: 'en',
  mcpEnabled: true,
  mcpServers: {},
  permissions: DEFAULT_PERMISSIONS,
  defaultPermissionMode: 'default',
  maxTurns: 100,
};
