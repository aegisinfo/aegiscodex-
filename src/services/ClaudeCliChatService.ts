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
 * runs its own tools directly against this directory. There's no stdin
 * channel for the subprocess to ask the user a permission question (it's
 * spawned headless), so it always runs with bypassPermissions regardless of
 * aegiscode's own permission mode — except 'plan', which is read-only by
 * design and passed through as-is.
 *
 * Each `claude --print` call exits after one response, so a fresh process
 * has no memory of tool calls the previous turn started. We capture the
 * `session_id` from the first reply and pass it back via `--resume` on
 * later turns so the CLI continues the same session instead of replaying
 * the whole transcript as flat text into a brand-new one (which left tool
 * calls half-finished and re-described as text on every "continue").
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import type {
  Message,
  ToolDefinition,
  ChatResponse,
  IChatService,
  StreamCallbacks,
} from '../agent/types.js';
import { getPermissionMode as getStorePermissionMode } from '../store/vanilla.js';

export interface ClaudeCliChatServiceConfig {
  model?: string;
  /** aegiscode permission mode ('default' | 'autoEdit' | 'yolo' | 'plan'); mapped to claude CLI's --permission-mode. */
  permissionMode?: string;
  /** Kill the subprocess and reject if no reply within this many ms (default 600000). */
  timeout?: number;
}

// spawn('claude', ...) relies on process.env.PATH, which is fine in an interactive
// shell but NOT when aegiscode is launched from a GUI app (Electron's main process
// inherits whatever minimal PATH the desktop session/launcher set, often missing
// ~/.local/bin) — this is exactly where Claude Code's own installer puts the
// binary. Resolve an absolute path so Pro/Max chat doesn't ENOENT in that case.
let cachedClaudeBin: string | null | undefined;
function resolveClaudeBin(): string {
  if (cachedClaudeBin !== undefined) return cachedClaudeBin ?? 'claude';

  const home = homedir();
  const candidates = [
    ...(process.env.PATH || '').split(':').map(dir => join(dir, 'claude')),
    join(home, '.local', 'bin', 'claude'),
    join(home, '.npm-global', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];

  cachedClaudeBin = candidates.find(p => p && existsSync(p)) ?? null;
  return cachedClaudeBin ?? 'claude';
}

// Anything other than 'bypassPermissions' makes the CLI block on an interactive
// tool-permission prompt — but this subprocess is spawned headless (stdin
// 'ignore'), so there's no channel to ever answer that prompt. It just hangs
// until ClaudeCliChatService's own timeout kills it. So regardless of
// aegiscode's own permission mode, the subprocess always runs with
// bypassPermissions; 'plan' is the only mode kept distinct since it's
// read-only by design and doesn't need permission prompts at all.
const PERMISSION_MODE_MAP: Record<string, string> = {
  default: 'bypassPermissions',
  autoEdit: 'bypassPermissions',
  yolo: 'bypassPermissions',
  plan: 'plan',
};

// Pushed onto every call's system prompt — aegiscode already resolved relevant
// memory/project context into that prompt; re-discovering it via the subprocess's
// own Read/Grep/Bash tools wastes turns and can miss what aegiscode already knew.
const ASK_DONT_DIG_INSTRUCTION =
  'The system prompt above includes aegiscode\'s own project and memory context for ' +
  'this turn. Prefer that context over re-deriving it yourself. If something relevant ' +
  'is missing or ambiguous, ask the user directly rather than spending turns exploring ' +
  'files, git history, or memory on your own.';

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
  /** Set once the first reply gives us a session_id; reused via --resume on later turns. */
  private sessionId: string | undefined;

  constructor(private config: ClaudeCliChatServiceConfig) {}

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    streamCallbacks?: StreamCallbacks
  ): Promise<ChatResponse> {
    const args = ['--print', '--output-format', 'stream-json', '--include-partial-messages', '--verbose'];
    const currentMode = this.config.permissionMode || getStorePermissionMode() || 'default';
    const cliPermissionMode = PERMISSION_MODE_MAP[currentMode] ?? 'default';
    args.push('--permission-mode', cliPermissionMode);
    if (this.config.model) args.push('--model', this.config.model);

    // Always carry the current system message (Agent.ts rebuilds it fresh every
    // call with that turn's memory/project context) — even on --resume turns,
    // where it would otherwise be silently dropped, leaving the resumed session
    // to re-derive context itself via its own tools instead of using what
    // aegiscode already resolved.
    const { systemPrompt, prompt: fullPrompt } = transcriptFor(messages);
    const appendedSystem = [systemPrompt, ASK_DONT_DIG_INSTRUCTION].filter(Boolean).join('\n\n');

    // Large system/memory context plus a full resent transcript can blow past
    // the OS argv size limit (ARG_MAX) when passed as CLI arguments, killing
    // spawn() with E2BIG. Write the system prompt to a temp file and send the
    // prompt over stdin instead — neither touches argv, so there's no size cap.
    let systemPromptFile: string | undefined;
    let systemPromptDir: string | undefined;
    if (appendedSystem) {
      systemPromptDir = mkdtempSync(join(tmpdir(), 'aegis-sysprompt-'));
      systemPromptFile = join(systemPromptDir, 'system-prompt.txt');
      writeFileSync(systemPromptFile, appendedSystem);
      args.push('--append-system-prompt-file', systemPromptFile);
    }

    let prompt: string;
    if (this.sessionId) {
      // Resuming: the CLI already has the prior turns (and any tool calls it
      // started) in its own session — just send the newest user message.
      args.push('--resume', this.sessionId);
      prompt = messages.filter(m => m.role === 'user').at(-1)?.content ?? '';
    } else {
      prompt = fullPrompt;
    }

    const cleanupSystemPromptFile = () => {
      if (systemPromptDir) { try { rmSync(systemPromptDir, { recursive: true, force: true }); } catch { /* best effort */ } }
    };

    const result = await new Promise<{ content: string; usage?: ChatResponse['usage'] }>((resolve, reject) => {
      // Strip ANTHROPIC_API_KEY so the child claude binary uses its own
      // OAuth subscription login instead of our (possibly out-of-credit) key.
      const { ANTHROPIC_API_KEY, ...env } = process.env;
      const child = spawn(resolveClaudeBin(), args, { stdio: ['pipe', 'pipe', 'pipe'], env });
      child.stdin.write(prompt);
      child.stdin.end();

      const timeoutMs = this.config.timeout ?? 600000;
      const timeoutTimer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(
          `claude CLI timed out after ${Math.round(timeoutMs / 1000)}s with no response ` +
          `(likely blocked waiting on a tool-permission prompt that nothing can answer in this context)`
        ));
      }, timeoutMs);

      let stderr = '';
      let stdoutBuffer = '';
      let finalResult: { result?: string; usage?: { input_tokens?: number; output_tokens?: number }; is_error?: boolean } | null = null;

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        let parsed: any;
        try {
          parsed = JSON.parse(line);
        } catch {
          return;
        }

        if (parsed.session_id) this.sessionId = parsed.session_id;

        if (parsed.type === 'stream_event' && parsed.event) {
          // Wire format is identical to AnthropicChatService's SSE events —
          // forward as-is so the UI streams incrementally instead of one block.
          streamCallbacks?.onStreamEvent?.(parsed.event);
        } else if (parsed.type === 'result') {
          finalResult = parsed;
        }
      };

      child.stdout.on('data', d => {
        stdoutBuffer += d;
        let idx: number;
        while ((idx = stdoutBuffer.indexOf('\n')) !== -1) {
          handleLine(stdoutBuffer.slice(0, idx));
          stdoutBuffer = stdoutBuffer.slice(idx + 1);
        }
      });
      child.stderr.on('data', d => { stderr += d; });

      const onAbort = () => child.kill('SIGTERM');
      signal?.addEventListener('abort', onAbort);

      child.on('error', err => {
        clearTimeout(timeoutTimer);
        signal?.removeEventListener('abort', onAbort);
        cleanupSystemPromptFile();
        reject(new Error(
          `Failed to launch the claude CLI (${err.message}). Install it with: ` +
          `npm install -g @anthropic-ai/claude-code — then run "claude setup-token" ` +
          `and "/login --claude-pro" in aegiscode to connect your subscription.`
        ));
      });

      child.on('close', code => {
        clearTimeout(timeoutTimer);
        signal?.removeEventListener('abort', onAbort);
        cleanupSystemPromptFile();
        if (stdoutBuffer.trim()) handleLine(stdoutBuffer);
        if (signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
          return;
        }
        if (code !== 0 || !finalResult || finalResult.is_error) {
          reject(new Error(finalResult?.result || stderr.trim() || `claude CLI exited with code ${code}`));
          return;
        }
        const usage = finalResult.usage;
        resolve({
          content: finalResult.result ?? '',
          usage: usage && {
            promptTokens: usage.input_tokens ?? 0,
            completionTokens: usage.output_tokens ?? 0,
            totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          },
        });
      });
    });

    return { content: result.content, usage: result.usage };
  }
}
