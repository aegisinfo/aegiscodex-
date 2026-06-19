/**
 * Council tool — lets the running agent convene a multi-perspective
 * deliberation mid-conversation, without the user typing /research.
 * Mirrors the /research slash command (builtinCommands.ts) exactly:
 * fixed 4-member council, read-only tools, no confirmation needed.
 */
export declare const councilTool: import("../types.js").Tool<{
    question: string;
}>;
export default councilTool;
//# sourceMappingURL=council.d.ts.map