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
 */

import { spawn } from 'node:child_process';
import type {
  Message,
  ToolDefinition,
  ChatResponse,
  IChatService,
  StreamCallbacks,
} from '../agent/types.js';

export interface ClaudeCliChatServiceConfig {
  model?: string;
  /** aegiscode permission mode ('default' | 'autoEdit' | 'yolo' | 'plan'); mapped to claude CLI's --permission-mode. */
  permissionMode?: string;
}

const PERMISSION_MODE_MAP: Record<string, string> = {
  default: 'default',
  autoEdit: 'acceptEdits',
  yolo: 'bypassPermissions',
  plan: 'plan',
};

function transcriptFor(messages: Message[]): { systemPrompt: string; prompt: string } {
  const systemParts = messages.filter(m => m.role === 'system').map(m => m.content);
  const turns = messages.filter(m => m.role === 'user' || m.role === 'assistant');

  // claude --print answers one prompt at a time; fold prior turns into the
  // prompt text itself so multi-turn context survives across calls (mirrors
  // how OpenAIChatService is called — aegiscode always resends full history).
  const lines: string[] = [];
  for (const m of turns) {
    lines.push(`${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`);
  }

  return { systemPrompt: systemParts.join('\n\n'), prompt: lines.join('\n\n') };
}

export class ClaudeCliChatService implements IChatService {
  constructor(private config: ClaudeCliChatServiceConfig) {}

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    streamCallbacks?: StreamCallbacks
  ): Promise<ChatResponse> {
    const { systemPrompt, prompt } = transcriptFor(messages);

    const args = ['--print', '--output-format', 'json'];
    const cliPermissionMode = PERMISSION_MODE_MAP[this.config.permissionMode ?? 'default'] ?? 'default';
    args.push('--permission-mode', cliPermissionMode);
    if (this.config.model) args.push('--model', this.config.model);
    if (systemPrompt) args.push('--append-system-prompt', systemPrompt);
    args.push('--', prompt);

    const result = await new Promise<{ content: string; usage?: ChatResponse['usage'] }>((resolve, reject) => {
      // Strip ANTHROPIC_API_KEY so the child claude binary uses its own
      // OAuth subscription login instead of our (possibly out-of-credit) key.
      const { ANTHROPIC_API_KEY, ...env } = process.env;
      const child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'], env });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });

      const onAbort = () => child.kill('SIGTERM');
      signal?.addEventListener('abort', onAbort);

      child.on('error', err => {
        signal?.removeEventListener('abort', onAbort);
        reject(new Error(`Failed to launch claude CLI: ${err.message}. Is it installed and on PATH?`));
      });

      child.on('close', code => {
        signal?.removeEventListener('abort', onAbort);
        if (signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
          return;
        }
        if (code !== 0) {
          reject(new Error(`claude CLI exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve({
            content: parsed.result ?? parsed.content ?? '',
            usage: parsed.usage && {
              promptTokens: parsed.usage.input_tokens,
              completionTokens: parsed.usage.output_tokens,
              totalTokens: (parsed.usage.input_tokens ?? 0) + (parsed.usage.output_tokens ?? 0),
            },
          });
        } catch {
          resolve({ content: stdout.trim() });
        }
      });
    });

    // The main chat path (src/ui/hooks/useCommandProcessor.ts) only wires up
    // onStreamEvent, not onContentDelta — it renders by feeding raw
    // Anthropic-format stream events through applyStreamEvent. This backend
    // has no real token stream (claude --print returns once, at the end), so
    // it emits the whole reply as a single text block via that same event
    // shape rather than the delta callback, which would otherwise render
    // nothing in the actual chat UI.
    if (streamCallbacks?.onStreamEvent && result.content) {
      streamCallbacks.onStreamEvent({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: result.content },
      });
      streamCallbacks.onStreamEvent({ type: 'content_block_stop', index: 0 });
      streamCallbacks.onStreamEvent({ type: 'message_stop' });
    }

    return { content: result.content, usage: result.usage };
  }
}
