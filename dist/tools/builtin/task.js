/**
 * Task tool — lets the running agent delegate read-only investigation
 * work to parallel sub-agents, mid-conversation, without the user typing
 * a slash command. Same machinery as /multi, restricted to Read/Grep/Glob
 * (see plan: no confirmationHandler reaches a tool's execute(), so only
 * ReadOnly-kind work is safe to trigger from inside a tool call).
 */
import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind } from '../types.js';
import { OrchestratorAgent } from '../../agent/orchestrator/OrchestratorAgent.js';
import { requireModelConfig, buildSourceContext } from '../../agent/orchestrator/utils.js';
const TaskSchema = z.object({
    tasks: z.array(z.object({
        description: z.string().describe('Short label for this investigation, e.g. "find auth bugs"'),
        prompt: z.string().describe('Detailed instructions for the sub-agent'),
    })).min(1).max(5).describe('One or more independent investigations to run in parallel'),
});
export const taskTool = createTool({
    name: 'Task',
    displayName: 'Delegate Task',
    kind: ToolKind.ReadOnly,
    schema: TaskSchema,
    description: {
        short: 'Delegate read-only investigation work to parallel sub-agents',
        long: `Spin up one or more read-only sub-agents (Read/Grep/Glob only) to investigate
the codebase in parallel, then return their findings.

Use this when:
- A question has multiple independent angles worth exploring at once
- You want a focused sub-agent to dig into one area without cluttering the main conversation

Sub-agents cannot write files or run commands — they only read and report back.
You're responsible for synthesizing their findings into your final answer.`,
    },
    execute: async ({ tasks }, context) => {
        let modelConfig;
        try {
            modelConfig = requireModelConfig();
        }
        catch (e) {
            const msg = e.message;
            return { success: false, llmContent: msg, displayContent: msg };
        }
        const agentConfig = {
            apiKey: modelConfig.apiKey,
            baseURL: modelConfig.baseURL,
            model: modelConfig.model,
            timeout: modelConfig.timeout,
        };
        const cwd = context?.cwd || process.cwd();
        const sourceCtx = buildSourceContext(cwd);
        const codeContext = sourceCtx
            ? `\n\nWorkspace context (project metadata + file tree + structure summaries + git changes):\n${sourceCtx}\n\nUse Read / Grep / Glob to examine these.`
            : '\n\nUse Read / Grep / Glob to explore the codebase before responding.';
        const orchestrator = new OrchestratorAgent('Task-Orchestrator', 'You coordinate read-only investigation sub-agents.');
        tasks.forEach((task, i) => {
            const agentCfg = {
                name: `agent-${i}`,
                role: 'Investigator',
                systemPrompt: `You are a focused investigation sub-agent. ${task.prompt}${codeContext}`,
                config: agentConfig,
                tools: ['Read', 'Grep', 'Glob'],
            };
            orchestrator.registerAgent(agentCfg);
        });
        try {
            const responses = await orchestrator.delegateParallel(tasks.map((task, i) => ({ agentName: `agent-${i}`, task: task.prompt })), tasks.length, context?.sessionId);
            const lines = [];
            responses.forEach((res, i) => {
                lines.push(`### ${tasks[i]?.description || res.agentName}`);
                lines.push(res.content || '*No response*');
                lines.push('');
            });
            const formatted = lines.join('\n').trim();
            return {
                success: true,
                llmContent: formatted,
                displayContent: `✓ Ran ${tasks.length} investigation${tasks.length > 1 ? 's' : ''} in parallel`,
            };
        }
        catch (e) {
            const msg = `Task delegation failed: ${e.message}`;
            return { success: false, llmContent: msg, displayContent: msg };
        }
    },
});
export default taskTool;
//# sourceMappingURL=task.js.map