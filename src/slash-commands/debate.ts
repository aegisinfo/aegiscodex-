/**
 * /debate — Multi-model debate & discussion command
 *
 * Launches a structured debate/discussion between multiple configured models.
 *
 * Usage:
 *   /debate "React vs SolidJS" --models gpt-4o,deepseek --rounds 3
 *   /debate "Ska vi använda microservices?"                 (auto-picks all available models)
 *   /debate "What's the best testing strategy?" --format qa --models gpt-4o,claude-sonnet-4
 */

import type { SlashCommand, SlashCommandResult, SlashCommandContext } from './types.js';
import type { AgentConfig } from '../agent/types.js';
import { DiscussionRoom, type DiscussionFormat, type DebateModelConfig } from '../agent/orchestrator/DiscussionRoom.js';
import type { DiscussionResult } from '../agent/orchestrator/DiscussionRoom.js';
import { configManager } from '../config/index.js';
import type { ModelConfig } from '../config/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────────

/**
 * Resolve model configs from arguments, falling back to all configured models.
 */
function resolveModels(modelArg: string | undefined): { models: DebateModelConfig[]; errors: string[] } {
  const cfg = configManager.getConfig();
  const allModels: ModelConfig[] = cfg.models || [];
  const errors: string[] = [];

  if (modelArg) {
    // Specific models requested: comma-separated IDs
    const ids = modelArg.split(',').map(s => s.trim().toLowerCase());
    const selected: DebateModelConfig[] = [];

    for (const id of ids) {
      const found = allModels.find(m =>
        m.id?.toLowerCase() === id ||
        m.model?.toLowerCase() === id ||
        m.name?.toLowerCase() === id
      );
      if (found) {
        selected.push(modelConfigToDebateModel(found, selected.length));
      } else {
        errors.push(`Model "${id}" not found in config. Use /model list to see available models.`);
      }
    }

    return { models: selected, errors };
  }

  // No specific models: use every model that has an apiKey configured,
  // capped at 4 to bound API cost / rate-limit fan-out.
  const configured = allModels.filter(m => m.apiKey && m.apiKey.length > 0);

  if (configured.length === 0) {
    return { models: [], errors: ['No configured models found. Add models with /model add or check your config.'] };
  }

  const selected = configured.slice(0, 4).map((m, i) => modelConfigToDebateModel(m, i));
  return { models: selected, errors: [] };
}

// Palette mirrors DiscussionRoom's COLORS so the names rendered here match the
// colors the room assigns internally.
const DEBATE_COLORS = [
  '\x1b[38;2;0;229;192m',   // teal
  '\x1b[38;2;124;111;212m', // purple
  '\x1b[38;2;244;114;182m', // pink
  '\x1b[38;2;249;115;22m',  // orange
  '\x1b[38;2;34;197;94m',   // green
  '\x1b[38;2;56;189;248m',  // sky
  '\x1b[38;2;250;204;21m',  // yellow
  '\x1b[38;2;239;68;68m',   // red
];

function modelConfigToDebateModel(mc: ModelConfig, index = 0): DebateModelConfig {
  return {
    name: mc.name || mc.id || mc.model || 'Unknown',
    color: DEBATE_COLORS[index % DEBATE_COLORS.length],
    config: {
      apiKey: mc.apiKey || '',
      baseURL: mc.baseURL,
      model: mc.model,
    },
  };
}

function parseArgs(args: string): {
  topic: string;
  models?: string;
  rounds: number;
  format: DiscussionFormat;
} {
  const trimmed = args.trim();
  let topic = trimmed;
  let modelsArg: string | undefined;
  let rounds = 2;
  let format: DiscussionFormat = 'debate';

  // Parse --models flag
  const modelsMatch = trimmed.match(/--models\s+(\S+)/);
  if (modelsMatch) {
    modelsArg = modelsMatch[1];
    topic = topic.replace(/--models\s+\S+/g, '').trim();
  }

  // Parse --rounds flag
  const roundsMatch = trimmed.match(/--rounds\s+(\d+)/);
  if (roundsMatch) {
    rounds = parseInt(roundsMatch[1], 10);
    if (rounds < 1) rounds = 1;
    if (rounds > 5) rounds = 5;
    topic = topic.replace(/--rounds\s+\d+/g, '').trim();
  }

  // Parse --format flag
  const formatMatch = trimmed.match(/--format\s+(\w+)/);
  if (formatMatch) {
    const valid: DiscussionFormat[] = ['debate', 'discussion', 'qa', 'panel'];
    const f = formatMatch[1].toLowerCase() as DiscussionFormat;
    if (valid.includes(f)) {
      format = f;
    }
    topic = topic.replace(/--format\s+\w+/g, '').trim();
  }

  // Strip quotes around topic
  topic = topic.replace(/^["']|["']$/g, '').trim();

  if (!topic) {
    throw new Error('Usage: /debate <topic> [--models id1,id2] [--rounds N] [--format debate|discussion|qa|panel]');
  }

  return { topic, models: modelsArg, rounds, format };
}

// ── Command ───────────────────────────────────────────────────────────────────────

export const debateCommand: SlashCommand = {
  name: 'debate',
  aliases: ['db'],
  description: 'Multi-model debate — pitch models against each other on a topic',
  category: 'general',
  usage: '/debate <topic> [--models id1,id2] [--rounds N] [--format debate|discussion|qa|panel]',
  examples: [
    '/debate React vs SolidJS --models gpt-4o,deepseek-chat',
    '/debate "Should we use microservices?" --rounds 3',
    '/debate "What is the best testing strategy?" --format qa',
    '/debate "Future of AI coding assistants" --format panel --models gpt-4o,claude-sonnet-4,gemini-2.5-pro',
  ],
  fullDescription: `Run a structured debate or discussion between multiple AI models.

Each model takes turns responding, seeing all previous responses.
Results are streamed in real-time via the chat interface.

Formats:
  debate       — Models argue opposing positions (default)
  discussion   — Collaborative exploration of a topic
  qa           — Models answer a question from their perspective
  panel        — Expert panel discussion with moderator-style prompts

Flags:
  --models   Comma-separated model IDs (default: all configured models, max 4)
  --rounds   Number of rounds (1-5, default 2)
  --format   Debate format (debate, discussion, qa, panel)`,
  async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    try {
      const parsed = parseArgs(args);
      const resolved = resolveModels(parsed.models);

      if (resolved.models.length === 0) {
        const error = resolved.errors.join('\n') || 'No models could be resolved.';
        return { success: false, type: 'error', content: error };
      }

      if (resolved.errors.length > 0) {
        // Non-fatal: some models not found, but we have some
        if (context.onContentDelta) {
          context.onContentDelta(`*Note: ${resolved.errors.join('; ')}*\n\n`);
        }
      }

      // Build the discussion room
      const room = new DiscussionRoom({
        topic: parsed.topic,
        models: resolved.models,
        rounds: parsed.rounds,
        format: parsed.format,
        maxTokensPerResponse: 600,
        timeout: 120000,
      });

      // Stream start notification
      const formatIcons: Record<string, string> = {
        debate: '⚖️',
        discussion: '💬',
        qa: '❓',
        panel: '🎙️',
      };
      const icon = formatIcons[parsed.format] || '💬';
      const modelNames = resolved.models.map(m => m.name).join(', ');

      if (context.onContentDelta) {
        context.onContentDelta(`## ${icon} ${parsed.format.charAt(0).toUpperCase() + parsed.format.slice(1)}: ${parsed.topic}\n\n`);
        context.onContentDelta(`*Models: ${modelNames} · ${parsed.rounds} rounds*\n\n`);
      }

      // Stream rounds in real-time via event system
      let streamingRound = false;

      room.on('round:start', (ev) => {
        streamingRound = true;
        if (context.onContentDelta) {
          context.onContentDelta(`### Round ${ev.round}\n\n`);
        }
      });

      room.on('model:start', (ev) => {
        if (context.onContentDelta) {
          const model = resolved.models.find(m => m.name === ev.model);
          const color = model?.color || '';
          context.onContentDelta(`**${color}${ev.model}${color ? '\x1b[0m' : ''}** thinking...\n\n`);
        }
      });

      room.on('model:complete', (ev) => {
        if (context.onContentDelta) {
          const model = resolved.models.find(m => m.name === ev.model);
          const color = model?.color || '';
          context.onContentDelta(`**${color}${ev.model}${color ? '\x1b[0m' : ''}** · ${ev.metadata?.durationMs ? `_(${(ev.metadata.durationMs as number / 1000).toFixed(1)}s)_` : ''}\n\n`);
          context.onContentDelta(`${ev.content}\n\n`);
        }
      });

      room.on('model:error', (ev) => {
        if (context.onContentDelta) {
          context.onContentDelta(`**${ev.model}** ⚠️ *Failed: ${ev.content}*\n\n`);
        }
      });

      room.on('summary:ready', (ev) => {
        if (context.onContentDelta) {
          context.onContentDelta(`---\n\n### Summary\n\n${ev.content}\n\n`);
        }
      });

      room.on('discussion:complete', (ev) => {
        const meta = ev.metadata as unknown as DiscussionResult['metadata'] | undefined;
        if (context.onContentDelta && meta) {
          const secs = ((meta.totalDurationMs ?? 0) / 1000).toFixed(1);
          const tokens = (meta.totalTokens ?? 0).toLocaleString();
          context.onContentDelta(`*${meta.modelsUsed} models · ${meta.totalRounds} rounds · ${secs}s · ${tokens} tokens*\n`);
          context.onContentDelta(`\n✅ **Debate complete!**\n`);
        }
      });

      // Run the debate (events fire during execution via handlers above)
      await room.run();

      return { success: true, type: 'silent' };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        type: 'error',
        error: errMsg,
      };
    }
  },
};
