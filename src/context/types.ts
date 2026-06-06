/**
 * 
 */

import type { Message } from '../agent/types.js';

// ============================================================================
// ============================================================================

/**
 * 
 */
export interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * 
 */
export interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

// ============================================================================
// ============================================================================

/**
 * 
 */
export interface SystemContext {
  osType: string;
  osVersion: string;
  shell: string;
  nodeVersion: string;
  cwd: string;
}

/**
 * 
 */
export interface SessionContext {
  sessionId: string;
  userId?: string;
  preferences: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  startTime: number;
}

/**
 * 
 */
export interface ConversationContext {
  messages: ContextMessage[];
  topics: string[];
  lastActivity: number;
}

/**
 * 
 */
export interface ToolContext {
  recentCalls: ToolCallRecord[];
  toolStates: Record<string, unknown>;
  dependencies: Record<string, string[]>;
}

/**
 * 
 */
export interface WorkspaceContext {
  projectPath: string;
  gitBranch?: string;
  gitRemote?: string;
  packageJson?: {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
  };
}

/**
 * 
 */
export interface ContextLayer {
  system: SystemContext;
  session: SessionContext;
  conversation: ConversationContext;
  tool: ToolContext;
  workspace: WorkspaceContext;
}

/**
 * 
 */
export interface ContextData {
  layers: ContextLayer;
  metadata: {
    totalTokens: number;
    priority: number;
    relevanceScore?: number;
    lastUpdated: number;
  };
}

// ============================================================================
// ============================================================================

/**
 */
export type JSONLEntryType = 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system';

/**
 */
export interface JSONLEntry {
  
  uuid: string;
  
  parentUuid: string | null;
  
  sessionId: string;
  
  timestamp: string;
  
  type: JSONLEntryType;
  
  subtype?: 'compact_boundary';
  
  cwd: string;
  
  gitBranch?: string;
  
  version: string;
  
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string | unknown;
    model?: string;
    usage?: { input_tokens: number; output_tokens: number };
  };
  
  tool?: { id: string; name: string; input: unknown };
  
  toolResult?: { id: string; output: unknown; error?: string };
  
  isCompactSummary?: boolean;
  compactMetadata?: CompactMetadata;
}

/**
 * 
 */
export interface CompactMetadata {
  trigger: 'auto' | 'manual';
  preTokens: number;
  postTokens?: number;
  filesIncluded?: string[];
}

// ============================================================================
// ============================================================================

/**
 * 
 */
export interface StorageOptions {
  maxMemorySize: number;
  persistentPath: string;
  cacheSize: number;
  compressionEnabled: boolean;
}

/**
 * 
 */
export interface FilterOptions {
  maxTokens: number;
  maxMessages: number;
  timeWindow: number;
}

/**
 */
export interface ContextManagerOptions {
  storage: StorageOptions;
  defaultFilter: FilterOptions;
  compressionThreshold: number;
}

// ============================================================================
// ============================================================================

/**
 * 
 */
export interface CompactionOptions {
  trigger: 'auto' | 'manual';
  modelName: string;
  maxContextTokens: number;
  actualPreTokens?: number;
  chatService?: unknown;
  sessionId?: string;
  projectDir?: string;
}

/**
 * 
 */
export interface CompactionResult {
  success: boolean;
  summary: string;
  preTokens: number;
  postTokens: number;
  filesIncluded: string[];
  compactedMessages: Message[];
  error?: string;
}

/**
 * 
 */
export interface FileReference {
  path: string;
  mentions: number;
  lastMentioned: number;
  wasModified: boolean;
}

/**
 * 
 */
export interface FileContent {
  path: string;
  content: string;
  lines: number;
  truncated: boolean;
}

// ============================================================================
// ============================================================================

/**
 * 
 */
export interface MemoryInfo {
  hasData: boolean;
  messageCount: number;
  toolCallCount: number;
  lastUpdated: number | null;
}
