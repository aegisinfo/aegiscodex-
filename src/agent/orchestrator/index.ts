/**
 * Orchestrator — Multi-agent orchestration system
 */

export { OrchestratorAgent, createDefaultOrchestrator } from './OrchestratorAgent.js';
export { CouncilAgent } from './CouncilAgent.js';

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
