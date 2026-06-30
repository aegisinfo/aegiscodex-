---
name: models
description: Manage and configure AI/LLM models in aegiscodex — add, remove, switch models, configure auto-router, pricing, thinking budget, and per-model tool permissions.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash(git:*)
user-invocable: true
argument-hint: '[list|add|switch|pricing|router]'
version: "1.0"
---

# Models — AI Model Management for aegiscodex

aegiscodex supports multiple LLM providers: Anthropic (Claude), OpenAI (GPT, o-series), DeepSeek, Groq, Google Gemini, Ollama (local), Sakana AI, and the Nexus pooled router.

## Model Config Structure

Each model entry in `~/.aegiscode/config.json` (or a project-level config) uses this schema:

```typescript
interface ModelConfig {
  id: string;                            // unique identifier (e.g. "claude-sonnet-4")
  name: string;                          // display name
  provider: 'openai-compatible' | 'anthropic';
  apiKey: string;                        // API key (empty = disabled)
  baseURL: string;                       // API endpoint
  model: string;                         // model name sent to the API
  temperature?: number;                  // 0–2
  maxContextTokens?: number;
  topP?: number;
  topK?: number;
  allowedTools?: string[];               // tool whitelist (model-level)
  disallowedTools?: string[];            // tool blacklist (model-level)
  requireConfirmation?: boolean;         // require confirmation for tool calls
}
```

**Key files:**
- `src/config/types.ts` — Zod schemas for ModelConfig plus `ClawdConfigSchema` (full config shape)
- `src/config/index.ts` — config loading/merging logic
- `src/agent/pricing.ts` — per-model cost table ($/1M tokens, input/output)
- `src/agent/router.ts` — auto-router: classifies task complexity → picks cheapest usable model
- `~/.aegiscode/config.json` — user config (overrides defaults; `models[]` replaces the entire default list)

## Default Models

| id | name | provider | cost (i/o $/1M tok) |
|---|---|---|---|
| `claude-fable-5` | Claude Fable 5 | anthropic | $5 / $25 |
| `claude-sonnet-4` | Claude Sonnet 4.6 | anthropic | $3 / $15 |
| `claude-opus-4` | Claude Opus 4.8 | anthropic | $15 / $75 |
| `claude-haiku-4` | Claude Haiku 4.5 | anthropic | $0.80 / $4 |
| `deepseek-chat` | DeepSeek Chat | openai-compatible | $0.14 / $0.28 |
| `deepseek-reasoner` | DeepSeek Reasoner | openai-compatible | $0.55 / $2.19 |
| `groq-llama` | Groq Llama 3.3 70B | openai-compatible | $0.06 / $0.06 |
| `groq-deepseek` | Groq QwQ-32B | openai-compatible | $0.06 / $0.06 |
| `openai-gpt-4o` | GPT-4o | openai-compatible | $2.50 / $10 |
| `openai-gpt-5.5` | GPT-5.5 | openai-compatible | $10 / $40 |
| `openai-o3` | OpenAI o3 | openai-compatible | $10 / $40 |
| `chatgpt` | ChatGPT | openai-compatible | $2.50 / $10 |
| `gemini-2.5-pro` | Gemini 2.5 Pro | openai-compatible | $1.25 / $10 |
| `gemini-2.5-flash` | Gemini 2.5 Flash | openai-compatible | $0.15 / $0.60 |
| `ollama-local` | Ollama (local) | openai-compatible | $0 / $0 |
| `sakana-fugu` / `sakana-fugu-ultra` | Sakana AI Fugu | openai-compatible | (default fallback) |
| `nexus-fast` / `nexus-smart` / `nexus-neo` | Nexus pooled router | openai-compatible | (server-routed) |

## Auto-Router

The auto-router (defined in `src/agent/router.ts`) classifies tasks into three tiers using cheap heuristics (no LLM call):

- **simple** — questions, lookups, short explanations (≤25 words, no complex keywords)
- **medium** — intermediate tasks that don't fit simple or complex
- **complex** — refactoring, architecture, security, performance, or >80 words

**Router fallback order per tier** (cheapest → strongest):
- simple: `groq-llama` → `deepseek-chat` → `claude-haiku-4` → `gemini-2.5-flash` → `chatgpt`
- medium: `deepseek-chat` → `claude-sonnet-4` → `gemini-2.5-pro` → `openai-gpt-4o` → `chatgpt`
- complex: `claude-opus-4` → `openai-o3` → `claude-sonnet-4` → `gemini-2.5-pro` → `chatgpt`

Enable in config:
```json
{
  "autoRouter": { "enabled": true, "tiers": {} }
}
```

Override tiers:
```json
{
  "autoRouter": { "enabled": true, "tiers": { "simple": "groq-llama", "complex": "claude-opus-4" } }
}
```

## Thinking Budget (Extended Thinking)

For Anthropic models that support it. Configured in config:
```json
{ "thinking": { "budget": "off" } }
```

Options: `off` | `low` | `medium` | `high` | `max`

## Pricing & Cost Tracking

Prices tracked in `src/agent/pricing.ts` (`MODEL_COST_TABLE`). Cost is computed per-request using actual token counts:

```typescript
computeRawCost(modelId, promptTokens, completionTokens)  // raw provider cost
computeBilledCost(rawCost)                                // raw × 3 (AEGIS margin)
```

## Adding a New Model

1. Create the `ModelConfig` entry in user config (`~/.aegiscode/config.json`):
```json
{
  "id": "my-new-model",
  "name": "My New Model",
  "provider": "openai-compatible",
  "model": "my-model-name",
  "baseURL": "https://api.example.com/v1",
  "apiKey": "sk-...",
  "allowedTools": ["Read", "Grep", "Glob", "Edit", "Write", "Bash", "Skill", "Memory", "Task", "Council"]
}
```

2. Optionally add pricing in `src/agent/pricing.ts` → `MODEL_COST_TABLE`
3. Optionally add to auto-router fallbacks in `src/agent/router.ts` → `TIER_FALLBACKS`
4. Switch with: set `currentModelId` to the new `id` in config

## Common Tasks

- **List models** — check `models` array in config, or the `DEFAULT_MODELS` in `src/config/types.ts`
- **Switch model** — set `currentModelId` to the desired model's `id`
- **Disable a model** — set its `apiKey` to `""` (auto-router skips models with no key)
- **Per-model tool restrictions** — set `allowedTools` / `disallowedTools` on the model entry
- **Provider base URLs** — stored per-model; supports any OpenAI-compatible or Anthropic endpoint
