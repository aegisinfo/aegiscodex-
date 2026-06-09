/**
 * AEGIS Cross-Session Semantic Memory — v2
 *
 * Upgrades:
 *  1. Vector/embedding-based search via @xenova/transformers
 *  2. SQLite backend (sql.js WASM) for structured + vector storage
 *  3. Richer metadata: topics, entities, sentiment, token count
 */
import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';
import { v4 as uuid } from 'uuid';
import initSqlJs, { Database as SqlJsDb } from 'sql.js';
import { pipeline } from '@xenova/transformers';

// ── Paths ────────────────────────────────────────────────────────────────────
const MEMORY_DIR     = path.join(os.homedir(), '.aegiscode', 'memory');
const DB_PATH        = path.join(MEMORY_DIR, 'memory.db');
const CONFIG_FILE    = path.join(os.homedir(), '.aegiscode', 'config.json');
const SESSION_FILE   = path.join(MEMORY_DIR, 'last-session.txt');

// ── Feature flag — disable embeddings for testing / low-resource ────────────
const EMBEDDINGS_ENABLED = !process.env.AEGIS_MEMORY_NO_EMBED;
const OLLAMA_EMBED_URL  = process.env.AEGIS_OLLAMA_EMBED_URL || 'http://localhost:11434/api/embed';

// ── Constants ────────────────────────────────────────────────────────────────
const VECTOR_DIM_XENOVA = 384;  // all-MiniLM-L6-v2 output dimension
const VECTOR_DIM_OLLAMA = 768;  // nomic-embed-text output dimension
let ACTUAL_VECTOR_DIM   = VECTOR_DIM_XENOVA;  // auto-detected at runtime
const MAX_ENTRIES      = 5000;
const MAX_CONTENT_LEN  = 1000;

// ── Types ────────────────────────────────────────────────────────────────────
export interface MemoryEntry {
  id: string;
  timestamp: string;
  source: string;
  role: 'user' | 'assistant';
  tags: string[];
  content: string;
  session: string;
  importance?: number;          // 0-1
  summary?: boolean;

  // v2 rich metadata ──────────────────────────────────
  topics?: string[];            // extracted conversation topics
  entities?: string[];          // named entities (people, tools, code, etc.)
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  tokenCount?: number;
  embedding?: number[] | null;  // vector embedding (384-dim), null if disabled
}

export interface MemoryConfig {
  ttlDays?: number;
  maxEntries?: number;
  summaryEnabled?: boolean;
  embeddingModel?: string;      // override default embedding model
}

// ── Junk filter (unchanged) ─────────────────────────────────────────────────
const JUNK_PATTERNS = [
  /^Error:/i, /^model ->/i, /^⬡ AEGIS/i, /^## ⬡/i,
  /^## Models/i, /^## status/i, /^## Commands/i,
  /^\[STARTUP/i, /^Starting Container/i, /^WARNING:/i,
  /LLM API Error/i, /^\/model /i, /^\/status/i, /^\/memory/i,
  /^\/billing/i, /^\/council/i, /^\/help/i, /^\/theme/i,
  /^\/clear/i, /^\| sid/i, /^\|──/i, /^\| tok/i, /^\s*$/,
];

function isJunk(content: string): boolean {
  if (content.length < 8) return true;
  return JUNK_PATTERNS.some(p => p.test(content.trim()));
}

function stripInvalidChars(s: string): string {
  return s
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u2600-\u27FF]/g, '')
    .trim();
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  ['docker','railway','flask','python','typescript','react','aegis','joke',
   'music','sedur','frequ','codex','trading','stripe','memory','cloud',
   'bug','fix','deploy','error','api','database','security']
    .forEach(t => { if (content.toLowerCase().includes(t)) tags.push(t); });
  return tags;
}

// ── v2: Topic / entity / sentiment extraction ──────────────────────────────
function extractTopics(content: string): string[] {
  // Simple keyword-based topic extraction
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
    'discussion':   /\?|what|how|why|should|could|maybe|think/i,
  };
  return Object.entries(topicMap)
    .filter(([_, re]) => re.test(content))
    .map(([topic]) => topic);
}

function extractEntities(content: string): string[] {
  const entities: string[] = [];
  // Code patterns
  const funcMatches = content.match(/(?:function|class|def)\s+(\w+)/g);
  if (funcMatches) entities.push(...funcMatches.map(m => m.split(/\s+/)[1]));
  // File paths
  const fileMatches = content.match(/(?:`[^`]+`)/g);
  if (fileMatches) entities.push(...fileMatches.map(m => m.replace(/`/g, '')));
  // Package/module names
  const pkgMatches = content.match(/(?:from\s+|require\s*\(\s*['"])['"]([^'"]+)['"]/g);
  if (pkgMatches) entities.push(...pkgMatches.map(m => {
    const inner = m.match(/['"]([^'"]+)['"]/);
    return inner ? inner[1] : '';
  }));
  return [...new Set(entities)].filter(Boolean).slice(0, 10);
}

function detectSentiment(content: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
  const positiveWords = ['great','awesome','perfect','fixed','solved','works','love','excellent','good','thanks'];
  const negativeWords = ['broken','bug','error','crash','fails','terrible','bad','stupid','wrong','issue'];
  const lower = content.toLowerCase();
  let posScore = 0, negScore = 0;
  for (const w of positiveWords) { if (lower.includes(w)) posScore++; }
  for (const w of negativeWords)  { if (lower.includes(w)) negScore++; }
  if (posScore > 0 && negScore > 0) return 'mixed';
  if (posScore > 0) return 'positive';
  if (negScore > 0) return 'negative';
  return 'neutral';
}

function estimateTokens(text: string): number {
  // rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

// ── Importance scoring (enhanced) ───────────────────────────────────────────
function scoreImportance(content: string, role: 'user' | 'assistant'): number {
  let score = role === 'user' ? 0.7 : 0.4;
  if (/\?/.test(content)) score += 0.1;
  if (/```|function|class|import|export/.test(content)) score += 0.15;
  if (/decided|conclusion|solution|fixed|resolved|summary|key/i.test(content)) score += 0.15;
  if (content.length > 200) score += 0.1;
  if (content.length < 30) score -= 0.2;
  // Boost for explicit decisions
  if (/^decision:|^conclusion:|^important:/i.test(content.trim())) score += 0.2;
  return Math.max(0, Math.min(1, score));
}

// ── Config reader ───────────────────────────────────────────────────────────
function getMemoryConfig(): MemoryConfig {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return cfg?.memoryConfig ?? {};
  } catch { return {}; }
}

// ── Ollama embedding (fallback for local models) ────────────────────────────
let ollamaBaseUrl = '';

export function setOllamaBaseUrl(url?: string) {
  if (url && url.includes('11434')) {
    ollamaBaseUrl = url.replace(/\/+$/, '');
  }
}

// ── Embedding pipeline (singleton) ──────────────────────────────────────────
let embedPipeline: ((texts: string[]) => Promise<number[][]>) | null = null;

// Ollama embedding via its embed API (returns 768-dim for nomic-embed-text, 384 for all-minilm)
async function ollamaEmbed(texts: string[]): Promise<number[][]> {
  try {
    const res = await fetch(OLLAMA_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', input: texts.length === 1 ? texts[0] : texts }),
    });
    if (!res.ok) throw new Error(`Ollama embed HTTP ${res.status}`);
    const data = await res.json() as any;
    // Ollama returns { embeddings: number[][] } or { embedding: number[] } for single input
    if (data.embeddings) return data.embeddings as number[][];
    if (data.embedding) return [data.embedding as number[]];
    throw new Error('Unexpected Ollama response format');
  } catch (e) {
    console.warn('[Memory] Ollama embed failed:', e);
    throw e;
  }
}

async function getEmbedder(): Promise<((texts: string[]) => Promise<number[][]>) | null> {
  if (!EMBEDDINGS_ENABLED) return null;
  if (embedPipeline) return embedPipeline;

  // 1. Try Ollama first if configured
  if (process.env.AEGIS_OLLAMA_EMBED_URL || process.env.OLLAMA_HOST || ollamaBaseUrl) {
    try {
      const testRes = await fetch(OLLAMA_EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', input: 'test' }),
      });
      if (testRes.ok) {
        embedPipeline = async (texts: string[]) => {
          const result = await ollamaEmbed(texts);
          return result ?? texts.map(() => new Array(ACTUAL_VECTOR_DIM).fill(0));
        };
        console.warn('[Memory] Using Ollama embeddings (nomic-embed-text)');
        return embedPipeline;
      }
    } catch {
      console.warn('[Memory] Ollama not available, falling back to Xenova');
    }
  }

  // 2. Fallback to Xenova transformers (local)
  try {
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    embedPipeline = async (texts: string[]) => {
      const results = await Promise.all(
        texts.map(t => extractor(t, { pooling: 'mean', normalize: true }))
      );
      return results.map(r => Array.from(r.data as Float32Array));
    };
    console.warn('[Memory] Using Xenova local embeddings (all-MiniLM-L6-v2)');
    return embedPipeline;
  } catch (e) {
    console.warn('[Memory] Embedding model unavailable, falling back to keyword search');
    return null;
  }
}

// ── SQLite schema ───────────────────────────────────────────────────────────
async function initDb(): Promise<SqlJsDb> {
  const SQL = await initSqlJs();
  fs.mkdirSync(MEMORY_DIR, { recursive: true });

  let db: SqlJsDb;
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id          TEXT PRIMARY KEY,
      timestamp   TEXT NOT NULL,
      source      TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('user','assistant')),
      tags        TEXT NOT NULL DEFAULT '[]',
      content     TEXT NOT NULL,
      session     TEXT NOT NULL,
      importance  REAL NOT NULL DEFAULT 0.5,
      summary     INTEGER NOT NULL DEFAULT 0,
      topics      TEXT NOT NULL DEFAULT '[]',
      entities    TEXT NOT NULL DEFAULT '[]',
      sentiment   TEXT NOT NULL DEFAULT 'neutral',
      token_count INTEGER NOT NULL DEFAULT 0,
      embedding   BLOB
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session);
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
  `);

  return db;
}

// ── Helper: serialize JSON array to TEXT ────────────────────────────────────
function jsonArr(arr: string[]): string {
  return JSON.stringify(arr);
}
function parseJsonArr(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}

// ── Cosine similarity between two vectors ───────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ══════════════════════════════════════════════════════════════════════════
//  SharedMemory class
// ══════════════════════════════════════════════════════════════════════════
export class SharedMemory {
  private db!: SqlJsDb;
  public readonly userId: string;
  private embedder: ((texts: string[]) => Promise<number[][]>) | null = null;
  private ready: Promise<void>;

  constructor() {
    this.userId = this.loadUserId();
    this.ready = this.init();
  }

  private async init() {
    this.db = await initDb();
    this.embedder = await getEmbedder();
    this.applyTTL();
  }

  /** Await readiness before any operation */
  private async ensureReady() {
    await this.ready;
  }

  // ── User ID ─────────────────────────────────────────────────────────────
  private loadUserId(): string {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const stored = fs.readFileSync(SESSION_FILE, 'utf8').trim();
        if (stored) return stored;
      }
    } catch {}
    const id = 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
      fs.writeFileSync(SESSION_FILE, id);
    } catch {}
    return id;
  }

  // ── TTL ─────────────────────────────────────────────────────────────────
  private applyTTL() {
    const cfg = getMemoryConfig();
    if (!cfg.ttlDays) return;
    const cutoff = Date.now() - cfg.ttlDays * 24 * 60 * 60 * 1000;
    const isoCutoff = new Date(cutoff).toISOString();
    this.db.run(`DELETE FROM memories WHERE timestamp < ? AND summary = 0`, [isoCutoff]);
    this.commit();
  }

  // ── Add entry ───────────────────────────────────────────────────────────
  async add(
    content: string,
    source: string,
    session: string,
    tags: string[] = [],
    role: 'user' | 'assistant' = 'assistant',
    immediate = false,
  ): Promise<MemoryEntry | null> {
    await this.ensureReady();

    // Cross-semantic memory kräver prenumeration
    if (!this.isEnabled()) return null;

    const cleaned = stripInvalidChars(content);
    if (isJunk(cleaned)) return null;

    const cfg     = getMemoryConfig();
    const max     = cfg.maxEntries ?? MAX_ENTRIES;

    const id        = uuid();
    const timestamp = new Date().toISOString();
    const importance = scoreImportance(cleaned, role);
    const allTags    = [...new Set([...tags, ...extractTags(cleaned)])];
    const truncated  = cleaned.slice(0, MAX_CONTENT_LEN);
    const topics     = extractTopics(truncated);
    const entities   = extractEntities(truncated);
    const sentiment  = detectSentiment(truncated);
    const tokenCount = estimateTokens(truncated);

    // Generate embedding (async, can fail gracefully)
    let embeddingBuf: Buffer | null = null;
    if (this.embedder) {
      try {
        const vecs = await this.embedder([truncated]);
        if (vecs[0]) {
          embeddingBuf = Buffer.from(new Float32Array(vecs[0]).buffer);
        }
      } catch {
        // embedding failed — proceed without it
      }
    }

    this.db.run(`
      INSERT INTO memories (id, timestamp, source, role, tags, content, session,
                            importance, summary, topics, entities, sentiment, token_count, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, timestamp, source, role, jsonArr(allTags), truncated, session,
      importance, 0, jsonArr(topics), jsonArr(entities), sentiment, tokenCount, embeddingBuf,
    ]);

    // Enforce max entries
    const count = (this.db.exec(`SELECT COUNT(*) AS c FROM memories`)[0]?.values[0][0] as number) ?? 0;
    if (count > max) {
      this.db.run(`
        DELETE FROM memories WHERE id IN (
          SELECT id FROM memories ORDER BY importance DESC, timestamp DESC
          LIMIT -1 OFFSET ?
        )
      `, [max]);
    }

    this.commit();

    const entry: MemoryEntry = {
      id, timestamp, source, role, tags: allTags, content: truncated,
      session, importance, summary: false,
      topics, entities, sentiment, tokenCount,
      embedding: embeddingBuf ? Array.from(new Float32Array(embeddingBuf.buffer, embeddingBuf.byteOffset, embeddingBuf.byteLength / 4)) : null,
    };

    return entry;
  }

  // ── Search (hybrid: keyword + vector) ───────────────────────────────────
  async search(query: string, limit = 6): Promise<MemoryEntry[]> {
    await this.ensureReady();

    // Cross-semantic memory kräver prenumeration
    if (!this.isEnabled()) return [];

    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter(w =>
      w.length > 3 && !['what','that','this','with','have','from','your','just','been','were'].includes(w)
    );

    if (words.length === 0 && !this.embedder) {
      return this.recent(limit);
    }

    // ── Keyword score (ALL entries) ──
    const allRows = this.db.exec(`SELECT * FROM memories ORDER BY timestamp DESC LIMIT 1000`);
    const allEntries = this.rowsToEntries(allRows);

    const keywordScored = allEntries.map(e => {
      const text = (e.content + ' ' + e.tags.join(' ')).toLowerCase();
      const keywordScore = words.reduce((s, w) => {
        const count = (text.match(new RegExp(w, 'g')) || []).length;
        return s + count;
      }, 0);
      const importBoost = e.session === 'aegiscloud-import' ? 1.5 : 1;
      const total = keywordScore * (1 + (e.importance ?? 0.5)) * importBoost;
      return { entry: e, score: total };
    }).filter(({ score }) => score > 0);

    // Sort by keyword score
    keywordScored.sort((a, b) => b.score - a.score);

    // ── Vector score (embedding query) ──
    if (this.embedder && words.length > 0) {
      try {
        const [queryVec] = await this.embedder([q]);
        if (queryVec) {
          // Score top-50 keyword results with vector similarity
          const top50 = keywordScored.slice(0, 50);
          const vectorScored = top50.map(({ entry, score }) => {
            let vecSim = 0;
            if (entry.embedding && entry.embedding.length > 0) {
              vecSim = cosineSimilarity(queryVec, entry.embedding);
            }
            // Hybrid score: 40% keyword, 60% vector (if embedding available)
            const hybrid = score * 0.4 + vecSim * 6;
            return { entry, score: hybrid, vecSim };
          });
          vectorScored.sort((a, b) => b.score - a.score);
          return vectorScored.slice(0, limit).map(({ entry }) => entry);
        }
      } catch {
        // fall through to keyword-only
      }
    }

    return keywordScored.slice(0, limit).map(({ entry }) => entry);
  }

  recent(limit = 6): MemoryEntry[] {
    const rows = this.db.exec(`SELECT * FROM memories ORDER BY timestamp DESC LIMIT ?`, [limit]);
    return this.rowsToEntries(rows);
  }

  // ── Episodic summarization ───────────────────────────────────────────────
  async summarizeAndStoreSession(
    sessionId: string,
    apiKey?: string,
    baseURL?: string,
    model?: string,
  ): Promise<boolean> {
    await this.ensureReady();

    const cfg = getMemoryConfig();
    if (cfg.summaryEnabled === false) return false;

    const rows = this.db.exec(
      `SELECT * FROM memories WHERE session = ? AND summary = 0 ORDER BY timestamp DESC LIMIT 100`,
      [sessionId]
    );
    const sessionEntries = this.rowsToEntries(rows);
    if (sessionEntries.length < 3) return false;

    const existing = this.db.exec(
      `SELECT id FROM memories WHERE session = ? AND summary = 1 LIMIT 1`,
      [sessionId]
    );
    if (existing.length > 0) return false;

    const summary = await this.summarizeSession(sessionId, sessionEntries, apiKey, baseURL, model);
    if (!summary) return false;

    const id = 'sum_' + sessionId;
    const allTags = [...new Set(sessionEntries.flatMap(e => e.tags))];
    const summaryContent = `[Session Summary] ${stripInvalidChars(summary)}`;

    this.db.run(`
      INSERT INTO memories (id, timestamp, source, role, tags, content, session,
                            importance, summary, topics, entities, sentiment, token_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, new Date().toISOString(), 'aegis-cli', 'assistant',
      jsonArr(allTags), summaryContent, sessionId,
      0.9, 1, '["summary"]', '[]', 'neutral', estimateTokens(summaryContent),
    ]);

    this.commit();
    return true;
  }

  private async summarizeSession(
    sessionId: string,
    entries: MemoryEntry[],
    apiKey?: string,
    baseURL?: string,
    model?: string,
  ): Promise<string | null> {
    if (!apiKey || entries.length < 3) return null;

    const conversation = entries
      .slice(0, 20)
      .map(e => `${e.role.toUpperCase()}: ${e.content.slice(0, 200)}`)
      .join('\n');

    try {
      const isAnthropic = (baseURL || '').includes('anthropic.com');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(isAnthropic
          ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
          : { 'Authorization': `Bearer ${apiKey}` }),
      };

      const body = isAnthropic ? {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{ role: 'user', content: `Summarize this conversation in 2-3 sentences. Focus on key decisions, problems solved, and important context:\n\n${conversation}` }],
      } : {
        model: model || 'gpt-4o-mini',
        max_tokens: 150,
        messages: [
          { role: 'system', content: 'Summarize conversations in 2-3 sentences. Focus on key decisions, problems solved, and important context.' },
          { role: 'user', content: conversation },
        ],
      };

      const res = await fetch(
        isAnthropic ? 'https://api.anthropic.com/v1/messages' : `${baseURL}/chat/completions`,
        { method: 'POST', headers, body: JSON.stringify(body) }
      );
      const data = await res.json() as any;
      return isAnthropic
        ? data?.content?.[0]?.text
        : data?.choices?.[0]?.message?.content;
    } catch {
      return null;
    }
  }

  // ── buildContext ─────────────────────────────────────────────────────────
  async buildContext(query: string, maxEntries = 4, currentSession?: string): Promise<string> {
    await this.ensureReady();

    const subscribed = this.isEnabled();
    const seen = new Set<string>();
    const combined: MemoryEntry[] = [];

    if (subscribed) {
      // Prenumerant: full cross-session memory med sökning, summaries, senaste
      if (!subscribed) return '';
      const relevant  = await this.search(query, Math.min(4, maxEntries));
      const recent    = this.recent(Math.min(2, maxEntries));
      const summaryRows = this.db.exec(
        `SELECT * FROM memories WHERE summary = 1 ORDER BY timestamp DESC LIMIT 3`
      );
      const summaries = this.rowsToEntries(summaryRows);

      for (const e of summaries) {
        if (!seen.has(e.id)) { seen.add(e.id); combined.push(e); }
      }
      for (const e of relevant) {
        if (!seen.has(e.id)) { seen.add(e.id); combined.push(e); }
      }
      for (const e of recent) {
        if (!seen.has(e.id)) { seen.add(e.id); combined.push(e); }
      }
    }

    // Alla får alltid minnen från aktuell session (även utan prenumeration)
    if (currentSession) {
      const sessionRows = this.db.exec(
        `SELECT * FROM memories WHERE session = ? AND summary = 0 ORDER BY timestamp DESC LIMIT 4`,
        [currentSession]
      );
      const sessionContext = this.rowsToEntries(sessionRows);
      for (const e of sessionContext) {
        if (!seen.has(e.id)) { seen.add(e.id); combined.push(e); }
      }
    }

    if (combined.length === 0) return '';

    const bySession: Record<string, MemoryEntry[]> = {};
    for (const e of combined) {
      if (!bySession[e.session]) bySession[e.session] = [];
      bySession[e.session].push(e);
    }

    const lines: string[] = [
      '--- PREVIOUS CONVERSATIONS (for context) ---',
      'Use this context to answer questions about previous interactions.',
      '',
    ];

    for (const [session, entries] of Object.entries(bySession)) {
      const date = entries[0]?.timestamp?.slice(0, 10) ?? '';
      const isSummary = entries.some(e => e.summary);
      const isCurrentSession = session === currentSession;
      const isImport = session === 'aegiscloud-import' || session === 'imported';
      const label = isCurrentSession ? 'Current Session' : isSummary ? 'Summary' : isImport ? 'Imported' : 'Session';
      lines.push(`[${label} ${session.slice(0, 8)} · ${date}]`);
      const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      for (const e of sorted) {
        const prefix = e.summary ? 'SUMMARY:' : e.role === 'user' ? 'User:' : 'AEGIS:';
        const meta = e.topics?.length ? ` [topics: ${e.topics.join(', ')}]` : '';
        lines.push(`  ${prefix} ${e.content.slice(0, 200)}${meta}`);
      }
      lines.push('');
    }

    lines.push('--- END MEMORIES ---');
    return lines.join('\n');
  }

  // ── Utility ──────────────────────────────────────────────────────────────
  private rowsToEntries(execResult: any): MemoryEntry[] {
    const cols = execResult[0]?.columns ?? [];
    const rows = execResult[0]?.values ?? [];
    return rows.map((row: any[]) => {
      const obj: Record<string, any> = {};
      cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
      const entry: MemoryEntry = {
        id:         obj.id,
        timestamp:  obj.timestamp,
        source:     obj.source,
        role:       obj.role,
        tags:       parseJsonArr(obj.tags),
        content:    obj.content,
        session:    obj.session,
        importance: obj.importance,
        summary:    obj.summary === 1,
        topics:     parseJsonArr(obj.topics),
        entities:   parseJsonArr(obj.entities),
        sentiment:  obj.sentiment,
        tokenCount: obj.token_count,
        embedding:  null,
      };
      // Deserialize embedding blob if present — auto-detect dimension from byte length
      if (obj.embedding instanceof Uint8Array || obj.embedding instanceof Buffer) {
        const buf = obj.embedding as Buffer;
        const dim = buf.length / 4;
        if (Number.isInteger(dim) && (dim === VECTOR_DIM_XENOVA || dim === VECTOR_DIM_OLLAMA)) {
          entry.embedding = Array.from(new Float32Array(buf.buffer, buf.byteOffset, dim));
        }
      }
      return entry;
    });
  }

  private commit() {
    try {
      const data = this.db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch {}
  }

  // ── isEnabled ────────────────────────────────────────────────────────────
  isEnabled(): boolean {
    if (process.env.AEGIS_MEMORY_TOKEN) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (!cfg?.memory?.subscribed) {
          const updated = { ...cfg, memory: { ...cfg.memory, subscribed: true, token: process.env.AEGIS_MEMORY_TOKEN, activatedAt: new Date().toISOString() } };
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
        }
      } catch {}
      return true;
    }
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return cfg?.memory?.subscribed === true;
    } catch { return false; }
  }

  size(): number {
    const res = this.db.exec(`SELECT COUNT(*) AS c FROM memories`);
    return (res[0]?.values[0][0] as number) ?? 0;
  }

  clear() {
    this.db.run(`DELETE FROM memories`);
    this.commit();
  }

  export(): MemoryEntry[] {
    const rows = this.db.exec(`SELECT * FROM memories ORDER BY timestamp DESC`);
    return this.rowsToEntries(rows);
  }

  import(entries: MemoryEntry[], merge = true) {
    const existingRows = this.db.exec(`SELECT id FROM memories`);
    const existingIds = new Set(
      existingRows[0]?.values.map((r: any) => r[0] as string) ?? []
    );

    for (const e of entries) {
      if (!merge && existingIds.has(e.id)) continue;
      if (existingIds.has(e.id)) continue;

      let embeddingBuf: Buffer | null = null;
      if (e.embedding && e.embedding.length > 0) {
        embeddingBuf = Buffer.from(new Float32Array(e.embedding).buffer);
      }

      this.db.run(`
        INSERT OR REPLACE INTO memories
        (id, timestamp, source, role, tags, content, session, importance, summary,
         topics, entities, sentiment, token_count, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        e.id, e.timestamp, e.source, e.role, jsonArr(e.tags), e.content, e.session,
        e.importance ?? 0.5, e.summary ? 1 : 0,
        jsonArr(e.topics ?? []), jsonArr(e.entities ?? []), e.sentiment ?? 'neutral',
        e.tokenCount ?? estimateTokens(e.content), embeddingBuf,
      ]);
    }
    this.commit();
  }

  getSessionEntries(sessionId: string): MemoryEntry[] {
    const rows = this.db.exec(
      `SELECT * FROM memories WHERE session = ? ORDER BY timestamp DESC`,
      [sessionId]
    );
    return this.rowsToEntries(rows);
  }

  getStats() {
    const total = this.size();
    const sessionRes = this.db.exec(`SELECT COUNT(DISTINCT session) AS c FROM memories`);
    const sessions = (sessionRes[0]?.values[0][0] as number) ?? 0;
    const summaryRes = this.db.exec(`SELECT COUNT(*) AS c FROM memories WHERE summary = 1`);
    const summaries = (summaryRes[0]?.values[0][0] as number) ?? 0;
    const avgRes = this.db.exec(`SELECT AVG(importance) AS a FROM memories`);
    const avgImportance = (avgRes[0]?.values[0][0] as number) ?? 0;

    // Embedding stats
    const embedRes = this.db.exec(`SELECT COUNT(*) AS c FROM memories WHERE embedding IS NOT NULL`);
    const withEmbeddings = (embedRes[0]?.values[0][0] as number) ?? 0;

    return {
      total,
      sessions,
      summaries,
      avgImportance: avgImportance.toFixed(2),
      enabled: this.isEnabled(),
      withEmbeddings,
      embeddingsEnabled: EMBEDDINGS_ENABLED,
    };
  }

  /** Search by topic */
  searchByTopic(topic: string, limit = 10): MemoryEntry[] {
    const rows = this.db.exec(
      `SELECT * FROM memories WHERE topics LIKE ? ORDER BY importance DESC, timestamp DESC LIMIT ?`,
      [`%"${topic}"%`, limit]
    );
    return this.rowsToEntries(rows);
  }

  /** Search by entity */
  searchByEntity(entity: string, limit = 10): MemoryEntry[] {
    const rows = this.db.exec(
      `SELECT * FROM memories WHERE entities LIKE ? ORDER BY importance DESC, timestamp DESC LIMIT ?`,
      [`%"${entity}"%`, limit]
    );
    return this.rowsToEntries(rows);
  }
}

export const sharedMemory = new SharedMemory();
