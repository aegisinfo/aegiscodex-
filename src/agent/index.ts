/**
 * Agent 
 */

export { Agent, default as AgentDefault } from './Agent.js';
export { SimpleAgent } from './SimpleAgent.js';

// Orchestrator (Multi-agent)
export {
  OrchestratorAgent,
  createDefaultOrchestrator,
  CouncilAgent,
} from './orchestrator/index.js';

export type {
  SubAgentConfig,
  TaskDelegation,
  AgentResponse,
  OrchestrationResult,
  DeliberationConfig,
  DeliberationResult,
  VoteResult,
  VoteValue,
} from './orchestrator/index.js';

export type {
  // 
  Message,
  MessageRole,
  ToolCall,
  
  // 
  ChatContext,
  PermissionMode,
  ConfirmationHandler,
  
  // 
  LoopOptions,
  LoopResult,
  LoopError,
  LoopErrorType,
  
  // 
  ToolResult,
  ToolDefinition,
  
  // 
  AgentConfig,
  AgentOptions,
  
  // ChatService 
  ChatResponse,
  IChatService,
} from './types.js';
