# ⬡ aegiscode

> Multi-model AI agent for the terminal — semantic memory, council voting, multi-agent orchestration, and cloud sync.

Built on [ÆGIS](https://aegiscloud.org) · Open source · AGPL-3.0 · Built in Malmö, Sweden

---

## What is aegiscode?

aegiscode is a terminal AI agent that works with multiple model providers simultaneously. It remembers context across sessions, lets you consult a council of AI agents for important decisions, and can orchestrate complex tasks across specialized agents working in parallel.

**BYOK — Bring Your Own Key.** You connect directly to Anthropic, DeepSeek, Groq or Ollama with your own API keys. We charge only for ÆGIS-specific features like semantic memory.

---

## Requirements

- [Node.js](https://nodejs.org) v22+
- At least one API key (Anthropic, DeepSeek, Groq, or Ollama locally — Ollama is free)

---

## Install

```bash
git clone https://github.com/aegisinfo/aegiscode
cd aegiscode
bash install.sh
```

The install script builds the project and adds `aegis` to your PATH automatically.

### Manual install

```bash
npm install
npm run build
# add to PATH manually or run: node dist/main.js
```

---

## Configuration

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# Optional — from aegiscloud.org → Account Settings
AEGISCLOUD_API_KEY=aegis_...

# Optional — semantic memory ($2/month)
AEGIS_MEMORY_TOKEN=your-token
```

Or copy the example: `cp .env.example .env`

---

## Quick start

```bash
aegis                        # start interactive mode (uses default model)
aegis --model claude         # start with Claude Sonnet
aegis --model deepseek       # start with DeepSeek
aegis --model groq           # start with Groq Llama 3.3
aegis --model ollama         # start with local Ollama model (free)
aegis "your question"        # start with an initial message
aegis --continue             # resume last session
aegis --resume <session-id>  # resume a specific session
aegis --debug                # enable debug mode
aegis --yolo                 # auto-approve all tool executions
```

Switch model mid-session:

```
/model claude
/model deepseek
/model groq
```

---

## Slash commands

### Models

| Command | Description |
|---|---|
| `/model` | Show current model and available models |
| `/model claude` | Switch to Claude Sonnet (Anthropic) |
| `/model deepseek` | Switch to DeepSeek Chat |
| `/model groq` | Switch to Groq Llama 3.3 |
| `/model ollama` | Switch to local Ollama model |

### Memory

Semantic memory stores context across sessions so aegiscode remembers your projects, preferences and past decisions.

| Command | Description |
|---|---|
| `/memory` | Show memory status and recent entries |
| `/memory activate <token>` | Activate with token received after payment |
| `/memory clear` | Wipe all stored memories |

**Activate memory:**
1. Run `/memory` — Stripe payment link opens automatically
2. Pay $2/month at [aegiscloud.org](https://aegiscloud.org)
3. Receive activation token by email
4. Run `/memory activate <your-token>`

Or add to `.env`: `AEGIS_MEMORY_TOKEN=your-token` — activates automatically on next start.

### Council

Submit a question to multiple AI agents for deliberation and weighted voting.

| Command | Description |
|---|---|
| `/council <question>` | Start a council vote |

Three agents — Claude, DeepSeek and Groq — deliberate independently and vote JA/NEJ. Result: GODKÄNT or AVSLAGET.

**Requires:** `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, and `GROQ_API_KEY`. Missing keys are skipped gracefully.

### Orchestration

Decompose complex tasks across specialized agents working in parallel or in sequence.

| Command | Description |
|---|---|
| `/orchestrate <task>` | Decompose and delegate across agents |

**Built-in agent roles:**

| Role | Expertise |
|---|---|
| `architect` | System design, architecture, design patterns |
| `implementer` | Code generation, implementation details |
| `reviewer` | Code review, bug detection, best practices |
| `debugger` | Root cause analysis, debugging strategies |

### Cloud sync

Sync conversations to your ÆGIS account at aegiscloud.org.

| Command | Description |
|---|---|
| `/cloud` | Show sync status |
| `/cloud key <api_key>` | Connect your ÆGIS account |
| `/cloud sync on` | Enable auto-upload on exit |
| `/cloud sync off` | Disable auto-upload |

Get your API key at [aegiscloud.org](https://aegiscloud.org) → Account Settings.

### Other commands

| Command | Description |
|---|---|
| `/help` | Show all available commands |
| `/clear` | Clear conversation history |
| `/status` | Show session status |
| `/billing` | Show billing information |
| `/theme` | Change color theme |

---

## Supported models

| ID | Provider | Model | Key required |
|---|---|---|---|
| `claude` | Anthropic | claude-sonnet-4-6 | `ANTHROPIC_API_KEY` |
| `deepseek` | DeepSeek | deepseek-chat | `DEEPSEEK_API_KEY` |
| `groq` | Groq | llama-3.3-70b-versatile | `GROQ_API_KEY` |
| `ollama` | Local | qwen2.5-coder:1.5b (configurable) | None |

### Add your own models

Any OpenAI-compatible API works. Add to `~/.aegiscode/config.json`:

```json
{
  "models": [
    {
      "id": "my-model",
      "name": "My Custom Model",
      "model": "model-name",
      "baseURL": "https://api.myprovider.com/v1",
      "apiKey": "my-api-key"
    }
  ]
}
```

Works with Mistral, Together.ai, Cohere, Perplexity, OpenRouter, LM Studio and any self-hosted model via Ollama.

Switch with: `/model my-model`

---

## Pricing

| Feature | Price |
|---|---|
| CLI (all models, BYOK) | Free |
| Semantic memory | $2/month |
| Cloud sync | Free with ÆGIS account |

Payment: [aegiscloud.org](https://aegiscloud.org)

---

## Privacy

- Local memory stored at `~/.aegiscode/memory/shared.json` — your device, your control
- Cloud sync is opt-in only — disable with `/cloud sync off`
- We never sell your data

[Privacy Policy](https://aegiscloud.org/privacy) · [Terms of Service](https://aegiscloud.org/terms)

---

## License

AGPL-3.0 · [aegiscloud.org](https://aegiscloud.org)
# aegiscode
