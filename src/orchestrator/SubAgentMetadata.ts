/**
 * SubAgentMetadata — tracks sub-agent lifecycle metadata alongside session logs
 *
 * Mirrors Claude Code's `agent-<id>.meta.json` pattern, writing a structured
 * metadata file for every sub-agent spawn so post-hoc debugging, observability,
 * and session replay can see agent name, role, task, timing, and outcome.
 *
 * File location:
 *   ~/.aegis/projects/{escaped-project-path}/subagents/{agentName}-{spawnId}.meta.json
 *
 * This is the smallest version of the agent-<id>.meta.json pattern from Claude.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getProjectStoragePath } from '../context/storage/pathUtils.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentSpawnMeta {
  /** Unique spawn ID — deterministic from the session + sequence */
  spawnId: string;
  /** Agent name (matches SubAgentConfig.name) */
  agentName: string;
  /** Agent role (from SubAgentConfig.role) */
  role: string;
  /** The task string this agent was asked to execute */
  task: string;
  /** ISO timestamp of spawn */
  spawnedAt: string;
  /** ISO timestamp of completion (set when finish() is called) */
  completedAt?: string;
  /** Execution outcome */
  status: 'running' | 'success' | 'error';
  /** Duration in milliseconds */
  durationMs?: number;
  /** Token usage if reported */
  tokensUsed?: number;
  /** Tool call count if reported */
  toolCallsCount?: number;
  /** Error message on failure */
  error?: string;
  /** Session ID this agent belongs to */
  sessionId: string;
  /** Agent type hint — e.g. 'subagent', 'council', 'explore' */
  agentType?: string;
}

// ── Store ────────────────────────────────────────────────────────────────────

export class SubAgentMetadataStore {
  private readonly metaDir: string;

  constructor(projectPath?: string) {
    const base = projectPath || process.cwd();
    this.metaDir = path.join(getProjectStoragePath(base), 'subagents');
  }

  /**
   * Record that an agent was spawned.
   * Returns the metadata object so callers can call .finish() later.
   */
  async spawn(meta: Omit<AgentSpawnMeta, 'spawnedAt' | 'status'>): Promise<AgentSpawnMeta> {
    const entry: AgentSpawnMeta = {
      ...meta,
      spawnedAt: new Date().toISOString(),
      status: 'running',
    };
    await this.write(entry);
    return entry;
  }

  /**
   * Mark a previously spawned agent as finished (success or error).
   */
  async finish(
    spawnId: string,
    status: 'success' | 'error',
    details?: { durationMs?: number; tokensUsed?: number; toolCallsCount?: number; error?: string },
  ): Promise<AgentSpawnMeta | null> {
    // Read existing, update, re-write
    const all = await this.list();
    const idx = all.findIndex(m => m.spawnId === spawnId);
    if (idx === -1) return null;

    const entry: AgentSpawnMeta = {
      ...all[idx],
      completedAt: new Date().toISOString(),
      status,
      ...(details?.durationMs !== undefined ? { durationMs: details.durationMs } : {}),
      ...(details?.tokensUsed !== undefined ? { tokensUsed: details.tokensUsed } : {}),
      ...(details?.toolCallsCount !== undefined ? { toolCallsCount: details.toolCallsCount } : {}),
      ...(details?.error !== undefined ? { error: details.error } : {}),
    };
    await this.write(entry);
    return entry;
  }

  /**
   * Read all metadata entries for the current project.
   */
  async list(): Promise<AgentSpawnMeta[]> {
    try {
      await fs.mkdir(this.metaDir, { recursive: true });
      const files = await fs.readdir(this.metaDir);
      const metas: AgentSpawnMeta[] = [];
      for (const file of files) {
        if (!file.endsWith('.meta.json')) continue;
        try {
          const content = await fs.readFile(path.join(this.metaDir, file), 'utf-8');
          metas.push(JSON.parse(content) as AgentSpawnMeta);
        } catch { /* skip corrupt files */ }
      }
      return metas.sort((a, b) => a.spawnedAt.localeCompare(b.spawnedAt));
    } catch {
      return [];
    }
  }

  /**
   * Get the most recent N metadata entries for a given agent name.
   */
  async recentForAgent(agentName: string, limit = 5): Promise<AgentSpawnMeta[]> {
    const all = await this.list();
    return all.filter(m => m.agentName === agentName).reverse().slice(0, limit);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async write(entry: AgentSpawnMeta): Promise<void> {
    await fs.mkdir(this.metaDir, { recursive: true });
    const fileName = `${entry.agentName}-${entry.spawnId}.meta.json`;
    const filePath = path.join(this.metaDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  }
}
