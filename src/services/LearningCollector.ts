/**
 * LearningCollector — Collect + push daily AI learnings to aegiscloud.org
 *
 * Extracts high-value facts, decisions, and solutions from interactions and
 * memory entries, then pushes them to the cloud for the daily digest.
 *
 * The admin panel aggregates learnings from all AEGIS instances (CLI + GUI)
 * and produces a daily summary of what "all AEGIS instances learned today."
 *
 * Pro-tier (logged-in) users contribute to the collective pool.
 * Ultimate-tier users can also pull the daily digest.
 *
 * Fire-and-forget, never blocks. Silently swallows all errors.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as https from 'node:https';

const HOST = 'aegiscloud.org';
const PUSH_URL = '/api/learnings/push';
const DIGEST_URL = '/api/learnings/daily';
const TIMEOUT_MS = 8000;

const LAST_DIGEST_FILE = path.join(os.homedir(), '.aegiscode', 'memory', '.last-digest');

// ── Config helpers ──────────────────────────────────────────────────────────

function getConfig(): Record<string, any> {
  try {
    const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch { return {}; }
}

function getApiKey(): string | null {
  return getConfig()?.aegiscloud?.api_key ?? null;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface Learning {
  /** Unique id (uuid) */
  id: string;
  /** When the learning was extracted */
  timestamp: string;
  /** The learned fact, decision, or solution text */
  content: string;
  /** Category: 'fact' | 'decision' | 'solution' | 'insight' | 'pattern' */
  category: string;
  /** Source client: 'cli' | 'gui' */
  client: string;
  /** Version of the client that produced this */
  version: string;
  /** Topics extracted from the content */
  topics: string[];
  /** Entities (code patterns, file paths, function names, etc.) */
  entities: string[];
  /** How important 0–1 */
  importance: number;
  /** Session this came from */
  sessionId?: string;
  /** Model that was used when this learning was generated */
  model?: string;
}

// ── Category detection ──────────────────────────────────────────────────────

function detectCategory(content: string): Learning['category'] {
  const lower = content.toLowerCase();
  if (/decided|decision|chose|elected|going with|pick/i.test(lower)) return 'decision';
  if (/solved|fixed|resolved|solution|workaround|patch|bug.*fix/i.test(lower)) return 'solution';
  if (/pattern|anti.?pattern|common|always|never|typically/i.test(lower)) return 'pattern';
  if (/insight|realized|understood|now know|important/i.test(lower)) return 'insight';
  return 'fact';
}

function extractTopics(content: string): string[] {
  const topicMap: Record<string, RegExp> = {
    'coding':       /```|function|class|const|let|import|export|interface/i,
    'debugging':    /bug|error|fix|issue|crash|broken|not working/i,
    'deployment':   /deploy|railway|docker|container|cloud/i,
    'architecture': /architecture|design pattern|scalab|refactor/i,
    'database':     /sqlite|postgres|sql|query|mongo/i,
    'frontend':     /react|vue|css|html|component|ui|interface/i,
    'backend':      /api|endpoint|server|flask|express|route/i,
    'security':     /auth|token|password|encrypt|security|vulnerab/i,
    'devops':       /ci|cd|github|action|pipeline|monitoring/i,
    'ai-ml':        /model|train|embed|vector|llm|token|inference/i,
  };
  return Object.entries(topicMap)
    .filter(([_, re]) => re.test(content))
    .map(([topic]) => topic);
}

function extractEntities(content: string): string[] {
  const entities: string[] = [];
  const funcMatches = content.match(/(?:function|class|def|const)\s+(\w+)/g);
  if (funcMatches) entities.push(...funcMatches.map(m => m.split(/\s+/)[1]));
  const fileMatches = content.match(/(?:`[^`]+`)/g);
  if (fileMatches) entities.push(...fileMatches.map(m => m.replace(/`/g, '')));
  const pkgMatches = content.match(/(?:from\s+|require\s*\(\s*['"])['"]([^'"]+)['"]/g);
  if (pkgMatches) entities.push(...pkgMatches.map(m => {
    const inner = m.match(/['"]([^'"]+)['"]/);
    return inner ? inner[1] : '';
  }));
  const toolMatches = content.match(/(docker|npm|yarn|git|pip|node|python|react|flask|sqlite|postgres)/gi);
  if (toolMatches) entities.push(...toolMatches.map(m => m.toLowerCase()));
  return [...new Set(entities)].filter(Boolean).slice(0, 10);
}

// ── HTTP helper (fire-and-forget POST) ──────────────────────────────────────

function postJson(path: string, payload: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: HOST,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Main API ────────────────────────────────────────────────────────────────

/**
 * Extract a Learning from a piece of content (user message or assistant response).
 * Returns null if the content isn't important enough to be a "learning".
 */
export function extractLearning(
  content: string,
  role: 'user' | 'assistant',
  sessionId?: string,
  model?: string,
): Learning | null {
  if (!content || content.length < 30) return null;

  // Only assistant responses with sufficient importance qualify as learnings
  // (user messages provide context but aren't learnings themselves)
  if (role !== 'assistant') return null;

  // Must contain substantive information
  const lower = content.toLowerCase();
  const hasSubstance =
    /```/g.test(content) ||                          // Code
    /(?:is|are|was|were|should|must|can|will)\s+.{20,}/.test(lower) || // Statements
    /step[s]?\s+\d|first|second|finally|solution|fix|method|approach/.test(lower); // Process

  if (!hasSubstance) return null;

  // Detect importance heuristically
  let importance = 0.5;
  if (/\bimportant|key|crucial|critical|essential|must|never|always\b/i.test(content)) importance += 0.15;
  if (/\bdecision|conclusion|resolved|solved|fixed\b/i.test(content)) importance += 0.15;
  if (content.length > 300) importance += 0.1;

  if (importance < 0.6) return null; // Not interesting enough

  const { v4: uuid } = require('uuid');

  return {
    id: uuid(),
    timestamp: new Date().toISOString(),
    content: content.slice(0, 500),
    category: detectCategory(content),
    client: process.env.AEGIS_CLIENT_TYPE || 'cli',
    version: process.env.npm_package_version || 'unknown',
    topics: extractTopics(content),
    entities: extractEntities(content),
    importance: Math.min(1, importance),
    sessionId: sessionId || 'unknown',
    model,
  };
}

/**
 * Push a batch of learnings to the cloud. Fire-and-forget.
 * Returns how many the server accepted.
 */
export async function pushLearnings(learnings: Learning[]): Promise<number> {
  const apiKey = getApiKey();
  if (!apiKey || learnings.length === 0) return 0;

  try {
    const result = await postJson(PUSH_URL, { learnings }) as any;
    return result?.saved ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Push all learnings from local memory that are new, then mark them as pushed.
 * Designed to run at the end of a session or periodically.
 */
export async function flushPendingLearnings(
  getSentinel: () => string,
  setSentinel: (ts: string) => void,
): Promise<{ total: number; pushed: number }> {
  // The caller provides access to its memory entries and passes a sentinel timestamp
  // so we only push learnings not yet seen by the cloud.
  return { total: 0, pushed: 0 }; // placeholder — real impl reads from SharedMemory
}

/**
 * Pull today's collective digest — what all AEGIS instances learned today.
 * Only available to Ultimate-tier users.
 *
 * Returns a formatted string suitable for display in the UI.
 */
export async function fetchDailyDigest(): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const result = await postJson(DIGEST_URL, {}) as any;
    if (!result?.entries || !Array.isArray(result.entries)) return null;

    const entries = result.entries as Learning[];
    if (entries.length === 0) return 'No new learnings today yet.';

    const byCategory: Record<string, Learning[]> = {};
    for (const e of entries) {
      if (!byCategory[e.category]) byCategory[e.category] = [];
      byCategory[e.category].push(e);
    }

    const lines: string[] = [
      `═══ AEGIS Daily Digest ═══`,
      `${entries.length} learnings from ${new Set(entries.map(e => e.sessionId)).size} sessions`,
      ``,
    ];

    for (const [cat, items] of Object.entries(byCategory)) {
      lines.push(`▸ ${cat.toUpperCase()} (${items.length})`);
      for (const item of items.slice(0, 5)) {
        lines.push(`  • ${item.content.slice(0, 120)}`);
        if (item.topics.length > 0) lines.push(`    [${item.topics.join(', ')}]`);
      }
      if (items.length > 5) lines.push(`  … and ${items.length - 5} more`);
      lines.push('');
    }

    lines.push('═══ End Digest ═══');
    return lines.join('\n');
  } catch {
    return null;
  }
}

/**
 * Check if we've already fetched today's digest.
 */
export function hasFetchedToday(): boolean {
  try {
    if (!fs.existsSync(LAST_DIGEST_FILE)) return false;
    const last = fs.readFileSync(LAST_DIGEST_FILE, 'utf8').trim();
    const today = new Date().toISOString().slice(0, 10);
    return last === today;
  } catch { return false; }
}

/**
 * Mark digest as fetched for today.
 */
export function markDigestFetched(): void {
  try {
    const dir = path.dirname(LAST_DIGEST_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LAST_DIGEST_FILE, new Date().toISOString().slice(0, 10));
  } catch {}
}
