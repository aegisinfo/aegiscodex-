/**
 * Council tool — lets the running agent convene a multi-perspective
 * deliberation mid-conversation, without the user typing /research.
 * Mirrors the /research slash command (builtinCommands.ts) exactly:
 * fixed 4-member council, read-only tools, no confirmation needed.
 */

import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind } from '../types.js';
import { CouncilAgent } from '../../agent/orchestrator/CouncilAgent.js';
import { requireModelConfig, buildSourceContext } from '../../agent/orchestrator/utils.js';

const CouncilSchema = z.object({
  question: z.string().describe('The question or decision to deliberate on'),
});

export const councilTool = createTool({
  name: 'Council',
  displayName: 'Convene Council',
  kind: ToolKind.ReadOnly,
  schema: CouncilSchema,

  description: {
    short: 'Convene a 4-perspective council to deliberate on a question',
    long: `Spawns a research council of read-only sub-agents with different perspectives —
Analyst (data/empirical), Architect (systems/design), Ethicist (safety/fairness),
Pragmatist (implementation reality) — who each vote and reason independently,
then returns their views plus a synthesis.

Use this for genuinely contested questions where multiple angles matter
(architecture tradeoffs, risk calls, "should we do X" decisions) — not for
straightforward lookups.`,
  },

  execute: async ({ question }, context) => {
    let modelConfig;
    try {
      modelConfig = requireModelConfig();
    } catch (e) {
      const msg = (e as Error).message;
      return { success: false, llmContent: msg, displayContent: msg };
    }

    const cwd = context?.cwd || process.cwd();
    const sourceCtx = buildSourceContext(cwd);
    const baseModelCfg = { model: modelConfig.model, baseURL: modelConfig.baseURL || undefined, apiKey: modelConfig.apiKey };
    const researchTools = ['Read', 'Grep', 'Glob'];
    const researchNote = `\n\nWorkspace context (project metadata + file tree + structure summaries + git changes):\n${sourceCtx}\n\nRead files with Read tool, search with Grep, browse with Glob.\nAlways state VOTE: approve, reject, or abstain and REASONING: with clear justification.`;

    try {
      const council = new CouncilAgent('council', modelConfig, {
        rule: 'majority',
        maxTokensPerAgent: 800,
        enableIteration: false,
      });

      council.addMember('analyst', 'Data Analyst',
        `You are a Data Analyst on a research council. You reason from data, statistics, and empirical evidence.\nYou value measurable outcomes and quantitative reasoning.${researchNote}`,
        1, baseModelCfg, researchTools);

      council.addMember('architect', 'Systems Architect',
        `You are a Systems Architect on a research council. You evaluate designs, tradeoffs, and architectural decisions.\nYou focus on scalability, maintainability, and system coherence.${researchNote}`,
        1, baseModelCfg, researchTools);

      council.addMember('ethicist', 'Ethics & Safety Officer',
        `You are an Ethics & Safety Officer on a research council. You evaluate safety, fairness, privacy, and societal impact.\nYou raise concerns others might miss and advocate for responsible practices.${researchNote}`,
        1, baseModelCfg, researchTools);

      council.addMember('pragmatist', 'Pragmatic Engineer',
        `You are a Pragmatic Engineer on a research council. You evaluate practicality, implementation effort, and real-world constraints.\nYou balance idealism with what actually works in production.${researchNote}`,
        1, baseModelCfg, researchTools);

      const result = await council.deliberate(question, context?.sessionId);

      const lines: string[] = [];
      for (const v of result.voteResults) {
        lines.push(`### ${v.role}`);
        lines.push(`VOTE: ${v.vote}`);
        lines.push(v.reasoning);
        lines.push('');
      }
      lines.push(`### Verdict: ${result.approved ? 'APPROVED ✅' : 'REJECTED ❌'}`);
      lines.push('');
      lines.push('### Synthesis');
      lines.push('');
      lines.push(result.synthesis.trim() || `${result.voteResults.length} perspectives gathered.`);

      const formatted = lines.join('\n').trim();
      return {
        success: true,
        llmContent: formatted,
        displayContent: `✓ Council deliberated (${result.voteResults.length} perspectives, ${result.rounds} round${result.rounds === 1 ? '' : 's'})`,
      };
    } catch (e) {
      const msg = `Council deliberation failed: ${(e as Error).message}`;
      return { success: false, llmContent: msg, displayContent: msg };
    }
  },
});

export default councilTool;
