/**
 * CouncilAgent — Multi-agent deliberation and voting
 *
 * Upgraded from /council slash-command into a programmable
 * deliberation system that can be invoked from the agent loop.
 *
 * Features:
 * - Configurable roles with custom system prompts
 * - Weighted voting (each agent can have a vote weight)
 * - Structured deliberation with reasoning
 * - Customizable voting rules (consensus, majority, supermajority)
 */
import type { AgentConfig } from '../types.js';
export type VoteValue = 'approve' | 'reject' | 'abstain';
export interface VoteResult {
    agentName: string;
    role: string;
    vote: VoteValue;
    reasoning: string;
    weight: number;
    color: string;
}
export interface DeliberationConfig {
    /** Rule for determining outcome */
    rule: 'majority' | 'supermajority' | 'unanimous' | 'weighted';
    /** For supermajority: fraction required (e.g., 0.66) */
    supermajorityThreshold?: number;
    /** Max tokens per agent response */
    maxTokensPerAgent?: number;
    /** Whether agents see each other's votes (for iteration) */
    enableIteration?: boolean;
    /** Max deliberation rounds */
    maxRounds?: number;
}
export interface DeliberationResult {
    approved: boolean;
    voteResults: VoteResult[];
    summary: string;
    config: DeliberationConfig;
    rounds: number;
}
export declare class CouncilAgent {
    private orchestrator;
    private config;
    private agentRoles;
    constructor(name: string, orchestratorConfig: AgentConfig, deliberationConfig?: Partial<DeliberationConfig>);
    /**
     * Register a council member with a specific role and vote weight
     */
    addMember(name: string, role: string, systemPrompt: string, weight: number | undefined, config: AgentConfig): void;
    /**
     * Remove a council member
     */
    removeMember(name: string): void;
    /**
     * Get all registered council members
     */
    getMembers(): {
        name: string;
        role: string;
        weight: number;
    }[];
    /**
     * Convene the council to deliberate on a question
     */
    deliberate(question: string): Promise<DeliberationResult>;
    private evaluateDecision;
    private buildSummary;
}
//# sourceMappingURL=CouncilAgent.d.ts.map