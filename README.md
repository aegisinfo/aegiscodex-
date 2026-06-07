# ⬡ aegiscode

> Multi-model AI agent for the terminal — semantic memory, council voting, multi-agent orchestration, and cloud sync.

Built on [ÆGIS](https://aegiscloud.org) · Open source · AGPL-3.0 · Built in Malmö, Sweden

---

## What is aegiscode?

aegiscode is a terminal AI agent that works with any model provider simultaneously. It remembers context across sessions, lets you consult a council of AI agents for important decisions, and can orchestrate complex tasks across specialized agents working in parallel.

**BYOK — Bring Your Own Key.** You connect directly to Anthropic, DeepSeek, Groq or Ollama with your own API keys. We charge only for ÆGIS-specific features like semantic memory ($2/month).

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

The install script builds the project, creates `~/.aegiscode/.env` for your API keys, and adds `aegis` to your PATH.

### Manual install

```bash
npm install
npm run build
# then add to PATH manually or run: node dist/main.js
```

---

## Configuration

Add your API keys to `~/.aegiscode/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

Config lives at `~/.aegiscode/config.json`. Switch models at runtime with `/model`.

---

## Usage

```bash
aegis                          # start interactive mode
aegis "explain this codebase"  # start with a message
aegis --resume <session-id>    # resume a previous session
```

---

## Slash Commands

| Command | Description |
|---|---|
| `/model` | Switch between configured models |
| `/multi <task>` | Spawn 4 specialist agents in parallel (architect, implementer, reviewer, debugger) |
| `/council <question>` | Multi-agent deliberation with voting |
| `/research <topic>` | Research council with analyst, architect, ethicist, pragmatist |
| `/memory activate <token>` | Activate semantic memory (requires subscription) |
| `/memory stats` | View memory statistics |
| `/memory clear` | Clear all stored memories |
| `/theme` | Switch UI theme |
| `/help` | List all commands |

---

## Semantic Memory

aegiscode can remember context across sessions using semantic search. Memory is a paid feature ($2/month) available at [aegiscloud.org](https://aegiscloud.org).

Once subscribed, activate with:

```
/memory activate <your-token>
```

Memory stores your conversations and retrieves relevant context automatically for every new session.

---

## Models

aegiscode works with any OpenAI-compatible API:

| Provider | Model | Notes |
|---|---|---|
| Anthropic | claude-sonnet-4-6 | Best quality |
| DeepSeek | deepseek-chat | Fast, cheap |
| Groq | llama-3.3-70b-versatile | Very fast |
| Ollama | any local model | Free, offline |

Switch at runtime: `/model claude`, `/model deepseek`, `/model groq`, `/model ollama`

---

## Custom Models

Add any OpenAI-compatible model to `~/.aegiscode/config.json`:

```json
{
  "models": [
    {
      "id": "my-model",
      "name": "My Custom Model",
      "model": "model-name",
      "baseURL": "https://api.example.com/v1",
      "apiKey": "your-key"
    }
  ]
}
```

---

## License

AGPL-3.0 — see [LICENSE](LICENSE)

---

[aegiscloud.org](https://aegiscloud.org) · [GitHub](https://github.com/aegisinfo/aegiscode)
