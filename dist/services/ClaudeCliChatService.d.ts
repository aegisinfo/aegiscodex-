/**
 * ClaudeCliChatService — backs chat completions with the real `claude` binary
 * as a subprocess, for Claude Code Pro/Max subscription auth.
 *
 * Anthropic gates OAuth subscription tokens (sk-ant-oat...) to the official
 * Claude Code client — direct API calls with that token get rejected, even
 * with the right beta headers, unless the request actually comes from the
 * claude binary. So instead of impersonating that client, this shells out to
 * the genuine `claude` CLI, which is the only sanctioned way to spend a
 * subscription on chat completions.
 *
 * `claude --print` doesn't emit OpenAI-style tool-call JSON aegiscode's own
 * Read/Write/Bash loop could intercept, so instead the spawned claude binary
 * runs its own tools directly against this directory. aegiscode's
 * permission mode is passed through via --permission-mode so the
 * subscription session honors the same approval policy the user configured.
 *
 * Each `claude --print` call exits after one response, so a fresh process
 * has no memory of tool calls the previous turn started. We capture the
 * `session_id` from the first reply and pass it back via `--resume` on
 * later turns so the CLI continues the same session instead of replaying
 * the whole transcript as flat text into a brand-new one (which left tool
 * calls half-finished and re-described as text on every "continue").
 */
import type { Message, ToolDefinition, ChatResponse, IChatService, StreamCallbacks } from '../agent/types.js';
export interface ClaudeCliChatServiceConfig {
    model?: string;
    /** aegiscode permission mode ('default' | 'autoEdit' | 'yolo' | 'plan'); mapped to claude CLI's --permission-mode. */
    permissionMode?: string;
}
export declare class ClaudeCliChatService implements IChatService {
    private config;
    /** Set once the first reply gives us a session_id; reused via --resume on later turns. */
    private sessionId;
    constructor(config: ClaudeCliChatServiceConfig);
    chat(messages: Message[], tools?: ToolDefinition[], signal?: AbortSignal, streamCallbacks?: StreamCallbacks): Promise<ChatResponse>;
}
//# sourceMappingURL=ClaudeCliChatService.d.ts.map