/**
 * Orchestrator — Multi-agent orchestration system
 */

export { OrchestratorAgent, createDefaultOrchestrator } from './OrchestratorAgent.js';
export { CouncilAgent } from './CouncilAgent.js';
export { DiscussionRoom } from './DiscussionRoom.js';

export { AppBuilder, runApp, getApp, getRegisteredApps, createBuiltinApps } from './AppBuilder.js';
export type { AppDefinition, AppRunOptions, AppRunResult } from './AppBuilder.js';

export { resolveModelConfig, requireModelConfig, createSubAgentToolkit, createSubAgentChatService, buildSourceContext } from './utils.js';
export type { ResolvedModelConfig, SubAgentOptions } from './utils.js';

export type {
  SubAgentConfig,
  TaskDelegation,
  AgentResponse,
  OrchestrationResult,
} from './OrchestratorAgent.js';

export type {
  DeliberationConfig,
  DeliberationResult,
  VoteResult,
  VoteValue,
} from './CouncilAgent.js';

export type {
  DiscussionConfig,
  DiscussionResult,
  DiscussionFormat,
  DebateRound,
  DebateModelConfig,
  DiscussionEvent,
  DiscussionEventType,
  DiscussionEventHandler,
} from './DiscussionRoom.js';
