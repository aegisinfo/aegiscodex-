/**
 * Task tool — lets the running agent delegate read-only investigation
 * work to parallel sub-agents, mid-conversation, without the user typing
 * a slash command. Same machinery as /multi, restricted to Read/Grep/Glob
 * (see plan: no confirmationHandler reaches a tool's execute(), so only
 * ReadOnly-kind work is safe to trigger from inside a tool call).
 */
export declare const taskTool: import("../types.js").Tool<{
    tasks: {
        description: string;
        prompt: string;
    }[];
}>;
export default taskTool;
//# sourceMappingURL=task.d.ts.map