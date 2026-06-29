/**
 * DiscussionRoom — Multi-model debate & discussion orchestrator
 *
 * Runs N AI models in a structured debate/discussion format.
 * Each model responds round-robin, seeing all previous responses.
 *
 * Design:
 *   - Creates one IChatService per model (shares existing infra)
 *   - Runs configurable rounds with optional moderator
 *   - Each model gets role-specific system prompt + full transcript
 *   - Results streamed via callback or returned as structured data
 */

import type { AgentConfig, IChatService, Message, ChatResponse } from '../types.js';
import { createChatService } from '../../services/ChatService.js';
import { agentMemoryBus } from '../../memory/AgentMemoryBus.js';
import { agentDebug } from '../../utils/debug.js';

// ── Types ────────────────────────────────────────────────────────────────────────

export type DiscussionFormat = 'debate' | 'discussion' | 'qa' | 'panel';

// ── Event system ───────────────────────────────────────────────────────────

export type DiscussionEventType =
  | 'model:start'       // Model starts generating a response
  | 'model:chunk'       // Streaming token from a model
  | 'model:complete'    // Model finished its response
  | 'model:error'       // Model failed
  | 'round:start'       // New round begins
  | 'discussion:complete' // All rounds done
  | 'summary:ready';    // Summary synthesized

export interface DiscussionEvent {
  type: DiscussionEventType;
  model?: string;
  round?: number;
  content?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export type DiscussionEventHandler = (event: DiscussionEvent) => void;

// ── Model config ───────────────────────────────────────────────────────────

export interface DebateModelConfig {
  /** Display name (e.g. "GPT-4o", "DeepSeek") */
  name: string;
  /** LLM config passed to createChatService */
  config: AgentConfig;
  /** Optional role description for system prompt */
  role?: string;
  /** Optional override color (ANSI 24-bit) */
  color?: string;
}

export interface DiscussionConfig {
  topic: string;
  models: DebateModelConfig[];
  /** Number of rounds (default 2) */
  rounds?: number;
  /** Format style (default 'debate') */
  format?: DiscussionFormat;
  /** Max tokens per response (default 500) */
  maxTokensPerResponse?: number;
  /** Optional moderator model index or name (pauses debate for mid-point synthesis) */
  moderator?: number | string;
  /** Timeout per model call in ms (default 60000) */
  timeout?: number;
}

export interface DebateRound {
  round: number;
  speaker: string;
  role: string;
  content: string;
  metadata?: {
    tokensUsed?: number;
    durationMs?: number;
  };
}

export interface DiscussionResult {
  topic: string;
  format: DiscussionFormat;
  rounds: DebateRound[];
  summary: string;
  metadata: {
    modelsUsed: number;
    totalRounds: number;
    totalDurationMs: number;
    totalTokens: number;
  };
}

// ── Colors ───────────────────────────────────────────────────────────────────────

const COLORS = [
  '\x1b[38;2;0;229;192m',   // teal
  '\x1b[38;2;124;111;212m',  // purple
  '\x1b[38;2;244;114;182m',  // pink
  '\x1b[38;2;249;115;22m',   // orange
  '\x1b[38;2;34;197;94m',    // green
  '\x1b[38;2;56;189;248m',   // sky
  '\x1b[38;2;250;204;21m',   // yellow
  '\x1b[38;2;239;68;68m',    // red
];

// ── DiscussionRoom ───────────────────────────────────────────────────────────────

export class DiscussionRoom {
  private config: DiscussionConfig & {
    rounds: number;
    format: DiscussionFormat;
    maxTokensPerResponse: number;
    timeout: number;
  };
  private services: Map<string, IChatService> = new Map();
  private listeners: Map<DiscussionEventType, Set<DiscussionEventHandler>> = new Map();
  private anyListeners: Set<DiscussionEventHandler> = new Set();

  constructor(config: DiscussionConfig) {
    this.config = {
      rounds: 2,
      format: 'debate',
      maxTokensPerResponse: 500,
      timeout: 60000,
      ...config,
    } as typeof this.config;

    // Create chat services for each model
    for (const model of this.config.models) {
      const svc = createChatService({
        ...model.config,
        timeout: this.config.timeout,
        maxOutputTokens: this.config.maxTokensPerResponse,
      });
      this.services.set(model.name, svc);
    }
  }

  // ── Event system ───────────────────────────────────────────────────────────

  /**
   * Subscribe to debate events.
   * Returns unsubscribe function.
   */
  on(type: DiscussionEventType, handler: DiscussionEventHandler): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
    return () => this.listeners.get(type)?.delete(handler);
  }

  /**
   * Subscribe to all debate events.
   */
  onAny(handler: DiscussionEventHandler): () => void {
    this.anyListeners.add(handler);
    return () => this.anyListeners.delete(handler);
  }

  private emit(type: DiscussionEventType, data: Omit<DiscussionEvent, 'type' | 'timestamp'>): void {
    const event: DiscussionEvent = { type, timestamp: Date.now(), ...data };
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const h of typeListeners) try { h(event); } catch { /* handler error */ }
    }
    for (const h of this.anyListeners) try { h(event); } catch { /* handler error */ }
  }

  // ── Core ───────────────────────────────────────────────────────────────────

  /**
   * Run the full debate and return structured results.
   */
  async run(): Promise<DiscussionResult> {
    const startTime = Date.now();
    const allRounds: DebateRound[] = [];
    const format = this.config.format;
    const models = this.config.models;

    // ── System prompt templates per format ──
    const roleTemplate = this.buildRoleTemplate(format);
    const debateGuidelines = this.buildDebateGuidelines(format);

    // Assign colors
    const namedColors = new Map(
      models.map((m, i) => [m.name, m.color || COLORS[i % COLORS.length]])
    );

    // ── Run rounds ──
    for (let round = 1; round <= this.config.rounds; round++) {
      const roundLabel = format === 'debate' ? `Argumentation` :
                         format === 'qa' ? `Question` : `Discussion`;

      this.emit('round:start', { round, content: roundLabel });

      for (const model of models) {
        this.emit('model:start', { model: model.name, round, content: '' });
        const durationStart = Date.now();

        // Build messages for this model: system + full transcript so far
        const messages: Message[] = [];
        messages.push({
          role: 'system',
          content: [
            roleTemplate,
            `\n\nYour name: ${model.name}`,
            model.role ? `\nRole: ${model.role}` : '',
            `\nTopic: ${this.config.topic}`,
            `\n\n${debateGuidelines}`,
            format === 'debate' ? `\nCurrent round: ${round}/${this.config.rounds}` : '',
          ].join(''),
        });

        // Inject conversation transcript
        if (allRounds.length > 0) {
          const transcript = allRounds
            .map(r => `[${r.speaker} (${r.role})]: ${r.content}`)
            .join('\n\n');
          messages.push({
            role: 'user',
            content: `Previous discussion:\n\n${transcript}\n\n---\n\n${
              format === 'debate'
                ? `Round ${round}/${this.config.rounds} — Present your arguments. Be specific and persuasive.`
                : format === 'qa'
                ? `Answer the question from your perspective.`
                : `Continue the discussion. Build on or challenge previous points.`
            }`,
          });
        } else {
          messages.push({
            role: 'user',
            content: format === 'debate'
              ? `Round 1/${this.config.rounds} — Opening statement. Present your position on: "${this.config.topic}"`
              : format === 'qa'
              ? `Question: "${this.config.topic}" — Provide your answer and reasoning.`
              : `Opening thoughts on: "${this.config.topic}" — Share your initial perspective.`,
          });
        }

        // Call the model
        let response: ChatResponse;
        try {
          response = await this.services.get(model.name)!.chat(messages);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          agentDebug.error(`[DiscussionRoom] ${model.name} failed: ${errMsg}`);

          this.emit('model:error', {
            model: model.name,
            round,
            content: errMsg,
          });

          // Publish error to agent memory bus
          agentMemoryBus.publish({
            channel: 'error',
            sourceAgent: model.name,
            sessionId: `debate-${format}-${this.config.topic.slice(0, 30)}`,
            content: `Failed to respond: ${errMsg}`,
            importance: 0.9,
            tags: ['debate', 'error'],
          }).catch(() => {});

          allRounds.push({
            round,
            speaker: model.name,
            role: model.role || 'participant',
            content: `[Failed to respond: ${errMsg}]`,
            metadata: { durationMs: Date.now() - durationStart },
          });
          continue;
        }

        const roundEntry: DebateRound = {
          round,
          speaker: model.name,
          role: model.role || 'participant',
          content: response.content,
          metadata: {
            tokensUsed: response.usage?.totalTokens,
            durationMs: Date.now() - durationStart,
          },
        };

        allRounds.push(roundEntry);

        this.emit('model:complete', {
          model: model.name,
          round,
          content: response.content,
          metadata: {
            tokensUsed: response.usage?.totalTokens,
            durationMs: Date.now() - durationStart,
          },
        });

        // Publish to agent memory bus so other components can observe
        agentMemoryBus.publish({
          channel: 'fact',
          sourceAgent: model.name,
          sessionId: `debate-${format}-${this.config.topic.slice(0, 30)}`,
          content: `[Debate Round ${round}] ${response.content.slice(0, 300)}`,
          importance: 0.5,
          tags: ['debate', `round-${round}`, format],
          metadata: { round, topic: this.config.topic },
        }).catch(() => {});
      }
    }

    // ── Synthesize summary ──
    const summary = this.synthesize(allRounds);

    this.emit('summary:ready', { content: summary });

    const totalTokens = allRounds.reduce(
      (sum, r) => sum + (r.metadata?.tokensUsed || 0), 0
    );

    const result: DiscussionResult = {
      topic: this.config.topic,
      format,
      rounds: allRounds,
      summary,
      metadata: {
        modelsUsed: models.length,
        totalRounds: this.config.rounds,
        totalDurationMs: Date.now() - startTime,
        totalTokens,
      },
    };

    this.emit('discussion:complete', { content: '', metadata: result.metadata as unknown as Record<string, unknown> });

    return result;
  }

  /**
   * Format debate results as a markdown string (for slash command output).
   */
  formatAsMarkdown(result: DiscussionResult): string {
    const lines: string[] = [];
    const formatIcon = result.format === 'debate' ? '⚖' :
                       result.format === 'qa' ? '❓' :
                       result.format === 'panel' ? '🎙' : '💬';
    const formatLabel = result.format.charAt(0).toUpperCase() + result.format.slice(1);

    lines.push(`## ${formatIcon} ${formatLabel}: ${result.topic}`);
    lines.push('');

    // Unique speakers with their displayed colors
    const speakers = [...new Set(result.rounds.map(r => r.speaker))];
    lines.push(`*Participants: ${speakers.join(', ')} · ${result.metadata.totalRounds} rounds*`);
    lines.push('');

    for (const round of result.rounds) {
      const color = this.config.models.find(m => m.name === round.speaker)?.color || COLORS[0];
      const r = round.round;
      lines.push(`### ${color}${round.speaker}${'\x1b[0m'} · ${round.role}  _(Round ${r})_`);
      lines.push('');
      lines.push(round.content);
      lines.push('');
    }

    lines.push('---');
    lines.push('### Summary');
    lines.push('');
    lines.push(result.summary);
    lines.push('');
    lines.push(`*${result.metadata.modelsUsed} models · ${result.metadata.totalRounds} rounds · ${(result.metadata.totalDurationMs / 1000).toFixed(1)}s · ${result.metadata.totalTokens.toLocaleString()} tokens*`);

    return lines.join('\n');
  }

  // ── Private ─────────────────────────────────────────────────────────────────────

  private buildRoleTemplate(format: DiscussionFormat): string {
    switch (format) {
      case 'debate':
        return 'You are participating in a structured debate. Present your position clearly and persuasively. Address counter-arguments when appropriate. Be concise but thorough.';
      case 'discussion':
        return 'You are participating in a collaborative discussion. Share your perspective, ask questions, and build on others\' ideas. Be constructive and insightful.';
      case 'qa':
        return 'You are answering questions as an expert in your field. Provide accurate, well-reasoned answers with specific details and examples when possible.';
      case 'panel':
        return 'You are a panelist in an expert discussion. Offer your professional perspective, reference relevant experience, and engage with other panelists\' viewpoints.';
      default:
        return 'You are participating in a discussion. Share your thoughts clearly.';
    }
  }

  private buildDebateGuidelines(format: DiscussionFormat): string {
    switch (format) {
      case 'debate':
        return `Guidelines:
- Be concise (max 3 paragraphs per round)
- Support claims with reasoning or evidence
- Address the strongest points made by other participants
- Stay on topic — do not introduce unrelated arguments
- Conclude each round with a clear takeaway`;
      case 'discussion':
        return `Guidelines:
- Be concise (max 3 paragraphs per turn)
- Build on or respectfully challenge previous points
- Ask clarifying questions when needed
- Keep the discussion productive and focused`;
      case 'qa':
        return `Guidelines:
- Be concise (max 2 paragraphs per answer)
- Provide specific, accurate information
- Acknowledge uncertainty when applicable
- Reference sources or reasoning where relevant`;
      case 'panel':
        return `Guidelines:
- Be concise (max 3 paragraphs per turn)
- Share real experiences and specific examples
- Engage with other panelists' points
- Keep the discussion accessible to the audience`;
      default:
        return 'Be concise and stay on topic.';
    }
  }

  /**
   * Synthesize all rounds into a summary using the last model or built-in logic.
   */
  private synthesize(allRounds: DebateRound[]): string {
    if (allRounds.length === 0) return 'No discussion took place.';

    // Extract key topics from all responses
    const topics = new Set<string>();
    const allText = allRounds.map(r => r.content).join(' ');

    // Simple keyword extraction for summary
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 20);

    // Build a structured summary
    const lines: string[] = [];
    lines.push(`Discussion on "${this.config.topic}" covered ${allRounds.length} contributions from ${this.config.models.length} participants.`);

    // Get final positions
    const lastWords = new Map<string, string>();
    for (const r of allRounds) {
      const sentences = r.content.split(/[.!?]+/).filter(Boolean);
      if (sentences.length > 0) {
        lastWords.set(r.speaker, sentences[sentences.length - 1].trim());
      }
    }

    if (lastWords.size > 0) {
      lines.push('');
      lines.push('**Closing positions:**');
      for (const [speaker, closing] of lastWords) {
        lines.push(`- ${speaker}: ${closing.slice(0, 150)}`);
      }
    }

    return lines.join('\n');
  }
}
