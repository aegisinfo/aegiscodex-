/**
 * 
 * 
 * 
 * - config.json: 基础配置（API、模型、UI）
 * - settings.json: 行为配置（权限、Hooks、环境变量）
 */

import { z } from 'zod';

// ========== 枚举定

/**
 * LLM API 提供商类型
 */
export type ProviderType = 'openai-compatible' | 'anthropic';

/**
 * 
 */
export enum PermissionMode {
  DEFAULT = 'default',     // 只读自动，写入需确
  AUTO_EDIT = 'autoEdit',  // 只读+写入自动，执行需确
  YOLO = 'yolo',           // 完全自动（危
  PLAN = 'plan',           // 只读自动，其他拦
}

// ========== Zod Schemas ==========

/**
 * 
 * 
 * 
 */
export const ModelConfigSchema = z.object({
  id: z.string().optional(),           // nanoid 自动生
  name: z.string().optional(),         // 显示名
  provider: z.enum(['openai-compatible', 'anthropic']).optional(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxContextTokens: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),

  // 模型级工具过滤：只在当前模型生效
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),

  // 是否需要确认提示（默认 true，保持原有行为）
  requireConfirmation: z.boolean().optional(),
});

/**
 * 
 */
export const PRESET_THEME_IDS = ['default', 'light', 'dark', 'ocean', 'forest', 'sunset'] as const;
export type PresetThemeId = typeof PRESET_THEME_IDS[number];

/**
 * UI 配置 Schema
 */
export const UIConfigSchema = z.object({
  // 支持所有预设主题，也支持自定义主题名
  theme: z.string().optional(),
});

/**
 * Auto-router Schema — per-tier model id overrides for simple/medium/complex tasks
 */
export const AutoRouterConfigSchema = z.object({
  enabled: z.boolean().optional(),
  tiers: z.object({
    simple: z.string().optional(),
    medium: z.string().optional(),
    complex: z.string().optional(),
  }).optional(),
});

/**
 * Extended-thinking Schema — budget tier sent as `thinking.budget_tokens` to
 * Anthropic models that support it. 'off' omits the thinking param entirely.
 */
export const ThinkingConfigSchema = z.object({
  budget: z.enum(['off', 'low', 'medium', 'high', 'max']).optional(),
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
 * MCP 服务器配置 Schema
 */
export const McpServerConfigSchema = z.object({
  type: z.enum(['stdio', 'sse', 'http']),
  
  // stdio 配
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  
  // sse/http 配置
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  
  // 其他配
  enabled: z.boolean().optional(),
  timeout: z.number().optional(),
  description: z.string().optional(),
  
  // 健康检查配
  healthCheck: z.object({
    enabled: z.boolean(),
    intervalMs: z.number(),
    timeoutMs: z.number(),
    maxFailures: z.number(),
  }).optional(),
});

/**
 * Hook 配置 Schema
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
  // 各事件类型的 Hook 列表（使用 passthrough 接受完整结
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
  // ===== 基础配
  
  // 默认模型配置（向后兼
  default: ModelConfigSchema.optional(),
  
  // 多模型配
  currentModelId: z.string().optional(),
  models: z.array(ModelConfigSchema).optional(),
  
  // 全局参
  temperature: z.number().min(0).max(2).optional(),
  maxContextTokens: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  stream: z.boolean().optional(),
  timeout: z.number().optional(),
  
  // UI
  ui: UIConfigSchema.optional(),
  theme: z.string().optional(),
  language: z.string().optional(),
  
  // 调
  debug: z.union([z.string(), z.boolean()]).optional(),
  
  // MCP
  mcpEnabled: z.boolean().optional(),
  mcpServers: z.record(McpServerConfigSchema).optional(),

  // 自动路由：按任务复杂度自动选择模型
  autoRouter: AutoRouterConfigSchema.optional(),

  // 扩展思考：发送给支持的模型的 thinking budget
  thinking: ThinkingConfigSchema.optional(),

  // ===== 行为配
  
  // 权
  permissions: PermissionConfigSchema.optional(),
  defaultPermissionMode: z.enum(['default', 'autoEdit', 'yolo', 'plan']).optional(),
  
  // 工具过
  toolWhitelist: z.array(z.string()).optional(),
  toolBlacklist: z.array(z.string()).optional(),
  
  // Hooks
  hooks: HookConfigSchema,
  
  // 环境变
  env: z.record(z.string()).optional(),
  
  // 其
  maxTurns: z.number().optional(),
});

/**
 * 
 * 
 */
export const RuntimeConfigSchema = ClawdConfigSchema.extend({
  // 系统提
  systemPrompt: z.string().optional(),
  appendSystemPrompt: z.string().optional(),
  
  // 会话管
  initialMessage: z.string().optional(),
  resumeSessionId: z.string().optional(),
  forkSession: z.boolean().optional(),
  
  // 工具过滤（CLI 临
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  
  // MCP（CLI 临
  mcpConfigPaths: z.array(z.string()).optional(),
  strictMcpConfig: z.boolean().optional(),
  
  // 其
  fallbackModel: z.string().optional(),
  addDirs: z.array(z.string()).optional(),
  outputFormat: z.enum(['text', 'json', 'stream-json']).optional(),
  print: z.boolean().optional(),
});

// ========== 类型导

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
export type AutoRouterConfig = z.infer<typeof AutoRouterConfigSchema>;
export type ThinkingConfig = z.infer<typeof ThinkingConfigSchema>;
export type PermissionConfig = z.infer<typeof PermissionConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type ClawdConfig = z.infer<typeof ClawdConfigSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

// 向后兼
export type Config = ClawdConfig;

// ========== 字段路由

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
  // config.json 字
  models: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  currentModelId: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  theme: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  language: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  mcpServers: { target: 'config', defaultScope: 'global', mergeStrategy: 'deep-merge', persistable: true },
  mcpEnabled: { target: 'config', defaultScope: 'global', mergeStrategy: 'replace', persistable: true },
  autoRouter: { target: 'config', defaultScope: 'global', mergeStrategy: 'deep-merge', persistable: true },
  thinking: { target: 'config', defaultScope: 'global', mergeStrategy: 'deep-merge', persistable: true },
  
  // settings.json 字
  permissions: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: true },
  defaultPermissionMode: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: true },
  hooks: { target: 'settings', defaultScope: 'local', mergeStrategy: 'deep-merge', persistable: true },
  env: { target: 'settings', defaultScope: 'local', mergeStrategy: 'deep-merge', persistable: true },
  
  // 非持久化字段（CLI 临时参
  systemPrompt: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: false },
  appendSystemPrompt: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: false },
  initialMessage: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: false },
  resumeSessionId: { target: 'settings', defaultScope: 'local', mergeStrategy: 'replace', persistable: false },
};

// ========== 默认配

/**
 * 
 */
export const DEFAULT_PERMISSIONS: PermissionConfig = {
  allow: [
    // 安全的系统信息命
    'Bash(pwd)',
    'Bash(whoami)',
    'Bash(hostname)',
    'Bash(uname *)',
    'Bash(date)',
    'Bash(echo *)',
    // 目录列
    'Bash(ls *)',
    'Bash(tree *)',
    // Git 只读命
    'Bash(git status)',
    'Bash(git log *)',
    'Bash(git diff *)',
    'Bash(git branch *)',
    // 包管理器只读命
    'Bash(npm list *)',
    'Bash(npm view *)',
    'Bash(bun *)',
  ],
  ask: [
    // 高风险命令（需要确
    'Bash(curl *)',
    'Bash(wget *)',
    'Bash(rm -rf *)',
    'Bash(rm -r *)',
  ],
  deny: [
    // 敏感文
    'Read(./.env)',
    'Read(./.env.*)',
    // 危险命
    'Bash(rm -rf /)',
    'Bash(sudo *)',
    'Bash(chmod 777 *)',
    // Shell 嵌
    'Bash(bash *)',
    'Bash(sh *)',
    'Bash(eval *)',
  ],
};

/**
 * 
 */
export const DEFAULT_MODELS = [
  {
    id: 'claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'anthropic' as const,
    model: 'claude-fable-5',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-6',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4.8',
    provider: 'anthropic' as const,
    model: 'claude-opus-4-8',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'claude-haiku-4',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic' as const,
    model: 'claude-haiku-4-5-20251001',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'deepseek-chat',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
    name: 'DeepSeek Chat',
    provider: 'openai-compatible' as const,
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: '',
    maxContextTokens: 1048576,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'openai-compatible' as const,
    model: 'deepseek-reasoner',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
    maxContextTokens: 1048565,
  },
  {
    id: 'groq-llama',
    name: 'Groq Llama 3.3 70B',
    provider: 'openai-compatible' as const,
    model: 'llama-3.3-70b-versatile',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'groq-deepseek',
    name: 'Groq QwQ-32B',
    provider: 'openai-compatible' as const,
    model: 'qwen-qwq-32b',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'openai-gpt-5.5',
    name: 'GPT-5.5',
    provider: 'openai-compatible' as const,
    model: 'gpt-5.5',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'openai-compatible' as const,
    model: 'chatgpt-4o-latest',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'openai-gpt-4o',
    name: 'GPT-4o',
    provider: 'openai-compatible' as const,
    model: 'gpt-4o',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'openai-o3',
    name: 'OpenAI o3',
    provider: 'openai-compatible' as const,
    model: 'o3',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'openai-compatible' as const,
    model: 'gemini-2.5-pro',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'openai-compatible' as const,
    model: 'gemini-2.5-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'openai-compatible' as const,
    model: 'gemini-2.0-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'ollama-local',
    name: 'Ollama (local)',
    provider: 'openai-compatible' as const,
    model: 'llama3.2',
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'sakana-fugu',
    name: 'Sakana Fugu',
    provider: 'openai-compatible' as const,
    model: 'fugu',
    baseURL: 'https://api.sakana.ai/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'sakana-fugu-ultra',
    name: 'Sakana Fugu Ultra',
    provider: 'openai-compatible' as const,
    model: 'fugu-ultra',
    baseURL: 'https://api.sakana.ai/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  // Nexus - AEGIS's pooled aegis-key. Auto-routes server-side (smart_router) to the
  // cheapest backend that fits the tier; OpenAI-wire-compatible, billed via token bank.
  {
    id: 'nexus-fast',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
    name: 'Nexus (Fast)',
    provider: 'openai-compatible' as const,
    model: 'nexus-fast',
    baseURL: 'https://aegisintel.up.railway.app/api/v1',
    apiKey: '',
  },
  {
    id: 'nexus-smart',
    name: 'Nexus (Smart)',
    provider: 'openai-compatible' as const,
    model: 'nexus-smart',
    baseURL: 'https://aegisintel.up.railway.app/api/v1',
    apiKey: '',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
  },
  {
    id: 'nexus-neo',
    allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'Memory', 'Task', 'Council'],
    requireConfirmation: false,
    name: 'Nexus (NEO)',
    provider: 'openai-compatible' as const,
    model: 'nexus-neo',
    baseURL: 'https://aegisintel.up.railway.app/api/v1',
    apiKey: '',
  },
];

export const DEFAULT_CONFIG: ClawdConfig = {
  default: {
    model: 'claude-sonnet-4-6',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: '',
  },
  models: DEFAULT_MODELS,
  currentModelId: 'claude-sonnet-4',
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
  autoRouter: { enabled: false, tiers: {} },
  thinking: { budget: 'off' },
  mcpServers: {},
  permissions: DEFAULT_PERMISSIONS,
  defaultPermissionMode: 'default',
  maxTurns: -1,
};
