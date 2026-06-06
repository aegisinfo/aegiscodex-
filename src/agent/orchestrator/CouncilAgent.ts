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
import { agentDebug } from '../../utils/debug.js';
import { OrchestratorAgent, type SubAgentConfig } from './OrchestratorAgent.js';

// ========== Types ==========

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

// ========== Constants ==========

const COLORS = [
  '\x1b[38;2;0;229;192m',  // teal
  '\x1b[38;2;124;111;212m', // purple
  '\x1b[38;2;244;114;182m', // pink
  '\x1b[38;2;249;115;22m',  // orange
  '\x1b[38;2;34;197;94m',   // green
  '\x1b[38;2;239;68;68m',   // red
  '\x1b[38;2;56;189;248m',  // sky
  '\x1b[38;2;250;204;21m',  // yellow
];

// ========== Council Agent ==========

export class CouncilAgent {
  private orchestrator: OrchestratorAgent;
  private config: DeliberationConfig;
  private agentRoles: Map<string, { role: string; weight: number; color: string }> = new Map();

  constructor(
    name: string,
    orchestratorConfig: AgentConfig,
    deliberationConfig: Partial<DeliberationConfig> = {}
  ) {
    this.orchestrator = new OrchestratorAgent(
      name,
      'You are the AEGIS Council moderator. Synthesize deliberation results.'
    );
    this.config = {
      rule: 'majority',
      maxTokensPerAgent: 300,
      enableIteration: false,
      maxRounds: 1,
      ...deliberationConfig,
    };
  }

  /**
   * Register a council member with a specific role and vote weight
   */
  addMember(
    name: string,
    role: string,
    systemPrompt: string,
    weight: number = 1,
    config: AgentConfig
  ): void {
    const colorIndex = this.agentRoles.size % COLORS.length;
    const color = COLORS[colorIndex];

    const subConfig: SubAgentConfig = {
      name,
      role,
      systemPrompt,
      config,
    };

    this.orchestrator.registerAgent(subConfig);
    this.agentRoles.set(name, { role, weight, color });
  }

  /**
   * Remove a council member
   */
  removeMember(name: string): void {
    this.orchestrator.unregisterAgent(name);
    this.agentRoles.delete(name);
  }

  /**
   * Get all registered council members
   */
  getMembers(): { name: string; role: string; weight: number }[] {
    return Array.from(this.agentRoles.entries()).map(([name, info]) => ({
      name,
      role: info.role,
      weight: info.weight,
    }));
  }

  /**
   * Convene the council to deliberate on a question
   */
  async deliberate(question: string): Promise<DeliberationResult> {
    const members = this.getMembers();
    if (members.length === 0) {
      throw new Error('CouncilAgent: No members registered. Add members before deliberating.');
    }

    let allResults: VoteResult[] = [];
    const rounds = Math.min(this.config.maxRounds || 1, 3);

    for (let round = 0; round < rounds; round++) {
      const subTasks: Record<string, string> = {};

      for (const member of members) {
        const previousContext = round > 0
          ? allResults
              .map(r => `${r.agentName} (${r.role}): Voted ${r.vote} — ${r.reasoning}`)
              .join('\n')
          : '';

        subTasks[member.name] = this.config.enableIteration && previousContext
          ? `Question: "${question}"\n\nPrevious round votes:\n${previousContext}\n\nBased on the discussion, state your FINAL VOTE and reasoning.\nRespond with:\nVOTE: approve, reject, or abstain\nREASONING: 1-3 sentences explaining your position.`
          : `Question: "${question}"\n\nState your vote and reasoning.\nRespond with:\nVOTE: approve, reject, or abstain\nREASONING: 1-3 sentences explaining your position.`;
      }

      const orchestration = await this.orchestrator.orchestrate(
        question,
        subTasks,
        members[0]?.name
      );

      // Parse votes from responses
      allResults = orchestration.responses.map(r => {
        const info = this.agentRoles.get(r.agentName);
        const content = r.content || '';
        const vote: VoteValue = content.includes('VOTE: approve')
          ? 'approve'
          : content.includes('VOTE: reject')
          ? 'reject'
          : 'abstain';
        const reasoning = content.split('REASONING:')[1]
          ? content.split('REASONING:')[1].trim().slice(0, 300)
          : content.slice(0, 200);

        return {
          agentName: r.agentName,
          role: info?.role || 'member',
          vote,
          reasoning,
          weight: info?.weight || 1,
          color: info?.color || COLORS[0],
        };
      });

      // Check if consensus reached early (for iterative mode)
      if (this.config.enableIteration && this.evaluateDecision(allResults).settled) {
        break;
      }
    }

    const decision = this.evaluateDecision(allResults);
    const summary = this.buildSummary(question, allResults, decision);

    return {
      approved: decision.approved,
      voteResults: allResults,
      summary,
      config: this.config,
      rounds,
    };
  }

  // ========== Private ==========

  private evaluateDecision(votes: VoteResult[]): {
    approved: boolean;
    settled: boolean;
    for: number;
    against: number;
    abstained: number;
  } {
    let forWeight = 0;
    let againstWeight = 0;
    let abstainedWeight = 0;
    let forCount = 0;
    let againstCount = 0;
    let abstainedCount = 0;

    for (const v of votes) {
      switch (v.vote) {
        case 'approve':
          forWeight += v.weight;
          forCount++;
          break;
        case 'reject':
          againstWeight += v.weight;
          againstCount++;
          break;
        case 'abstain':
          abstainedWeight += v.weight;
          abstainedCount++;
          break;
      }
    }

    const totalWeight = forWeight + againstWeight + abstainedWeight;
    const totalVoting = forWeight + againstWeight;
    const totalCount = forCount + againstCount + abstainedCount;

    switch (this.config.rule) {
      case 'unanimous':
        return {
          approved: forCount === totalCount && forCount > 0,
          settled: true,
          for: forCount,
          against: againstCount,
          abstained: abstainedCount,
        };
      case 'supermajority': {
        const threshold = this.config.supermajorityThreshold || 0.66;
        const weightedRatio = totalVoting > 0 ? forWeight / totalVoting : 0;
        return {
          approved: weightedRatio >= threshold,
          settled: true,
          for: forCount,
          against: againstCount,
          abstained: abstainedCount,
        };
      }
      case 'weighted':
        return {
          approved: forWeight > againstWeight,
          settled: true,
          for: forCount,
          against: againstCount,
          abstained: abstainedCount,
        };
      case 'majority':
      default:
        return {
          approved: forCount > againstCount,
          settled: forCount !== againstCount || forCount > 0,
          for: forCount,
          against: againstCount,
          abstained: abstainedCount,
        };
    }
  }

  private buildSummary(
    question: string,
    votes: VoteResult[],
    decision: { approved: boolean; for: number; against: number; abstained: number }
  ): string {
    const lines: string[] = [];
    lines.push('## ⬡ AEGIS COUNCIL');
    lines.push(`**Question:** ${question}`);
    lines.push('');

    for (const v of votes) {
      const emoji = v.vote === 'approve' ? '✅' : v.vote === 'reject' ? '❌' : '⚫';
      lines.push(`${v.color}${v.agentName}${'\x1b[0m'} · ${v.role}`);
      lines.push(`  ${emoji} ${v.vote.toUpperCase()} (weight: ${v.weight}) — ${v.reasoning}`);
      lines.push('');
    }

    const verdict = decision.approved ? '✅ APPROVED' : '❌ REJECTED';
    lines.push('---');
    lines.push(`${verdict} · ${decision.for} FOR · ${decision.against} AGAINST · ${decision.abstained} ABSTAINED`);

    return lines.join('\n');
  }
}
