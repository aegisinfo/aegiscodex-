# AEGISCode

**aegiscode remembers your project between sessions — so you never have to re-explain your stack, decisions, or context.**

Multi-model terminal coding assistant. Works with Claude, DeepSeek, Groq and Ollama. BYOK — your keys, your cost.

> **Semantic memory** — €2/month. The AI remembers you across every session.  
> Activate with `/memory activate <token>` after subscribing at [aegiscloud.org](https://aegiscloud.org).

```
╭── AEGISCode ◆ v1.8.0
  AI-powered terminal coding assistant
```

---

## Install

> Requires **Node.js >= 22**. Install via [nvm](https://github.com/nvm-sh/nvm): `nvm install 22`

**From npm:**

```bash
npm install -g aegis-cli
```

**From source (recommended — no sudo needed):**

```bash
git clone https://github.com/aegisinfo/aegiscode
cd aegiscode
bash install.sh
```

`install.sh` builds the project and creates an `aegis` wrapper in `~/.local/bin` — no global npm permissions required.

---

## First run

On startup you may see two harmless messages:

- `[DEP0040] DeprecationWarning: The punycode module is deprecated` — a Node.js internal warning, not from this project
- `[AEGIS] WARNING: Using Anthropic endpoint!` — informational only, confirms which API is active

Add your API keys to `.env` in the project root (or `~/.aegiscode/.env`) before starting:

```env
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

---

## Quick start

```bash
aegis                        # interactive mode
aegis "refactor this file"   # start with a message
aegis --model deepseek-chat  # use a specific model
aegis --continue             # resume last session
aegis --resume <session-id>  # resume specific session
```

---

## Configuration

Config lives at `~/.aegiscode/config.json`. Create it with:

```bash
aegis --init
```

Minimal example:

```json
{
  "currentModelId": "claude-sonnet-4",
  "models": [
    {
      "id": "claude-sonnet-4",
      "name": "Claude Sonnet 4",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "baseURL": "https://api.anthropic.com/v1",
      "apiKey": "sk-ant-..."
    }
  ]
}
```

API keys go in the model entry, not in `.bashrc` or environment variables — this prevents silent key conflicts across projects.

---

## Built-in models

AEGISCode ships with pre-configured entries for the following providers. Add your API key to activate them:

| ID | Model | Provider |
|----|-------|----------|
| `claude-sonnet-4` | claude-sonnet-4-20250514 | Anthropic |
| `claude-opus-4` | claude-opus-4-20250514 | Anthropic |
| `claude-haiku-4` | claude-haiku-4-5-20251001 | Anthropic |
| `deepseek-chat` | deepseek-chat | DeepSeek |
| `deepseek-reasoner` | deepseek-reasoner | DeepSeek |
| `groq-llama` | llama-3.3-70b-versatile | Groq |
| `groq-deepseek` | deepseek-r1-distill-llama-70b | Groq |
| `ollama-local` | llama3 | Ollama (local) |

Any OpenAI-compatible API can be added as a custom model.

---

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `/help` | `/?` `/h` | Show all commands |
| `/model` | `/m` | Interactive model switcher |
| `/model <id>` | | Switch to model by ID |
| `/model list` | | List all configured models |
| `/model add <id> <name> <model> <baseURL> <apiKey>` | | Add a custom model |
| `/model remove <id>` | | Remove a model |
| `/clear` | `/cls` | Clear chat history |
| `/compact` | | Compress context to save tokens |
| `/status` | `/st` | Show session info and token usage |
| `/theme` | `/t` | Switch UI theme |
| `/thinking` | | Toggle thinking blocks |
| `/copy` | `/cp` | Copy last code block to clipboard |
| `/copy N` | | Copy Nth code block |
| `/yolo` | | Toggle auto-approve for all tool calls |
| `/multi <task>` | | Run task across multiple agents |
| `/council <question>` | | Multi-model majority vote |
| `/research <question>` | | Multi-agent research |
| `/memory` | | Manage semantic memory |
| `/skills` | `/sk` | List loaded skills |
| `/hooks` | | View and manage hooks |
| `/version` | `/v` | Show version info |

### Adding a custom model

```
/model add openrouter-mixtral "Mixtral 8x7B" mistralai/mixtral-8x7b-instruct https://openrouter.ai/api/v1 sk-or-...
```

Changes are saved to `config.json` immediately.

---

## Tools

AEGISCode can read, write, and execute files in your project. Tool permissions are configured per-project in `config.json`:

```json
{
  "permissions": {
    "allow": ["Bash(git *)", "Bash(ls *)"],
    "ask":   ["Bash(curl *)", "Bash(rm -r *)"],
    "deny":  ["Bash(sudo *)", "Read(.env)"]
  }
}
```

Permission modes:

| Mode | Behavior |
|------|----------|
| `default` | Read auto, write requires confirmation |
| `autoEdit` | Read + write auto, execute requires confirmation |
| `yolo` | Everything auto-approved |
| `plan` | Read only, everything else blocked |

---

## Memory

Persistent cross-session memory requires an active subscription (€2/month via aegiscloud.org). Activate with a memory token:

```
/memory activate <token>
/memory stats
/memory clear
```

---

## Sessions

Sessions are stored locally as JSONL files. Resume a previous session:

```bash
aegis --continue              # resume most recent
aegis --resume <session-id>   # resume by ID
```

---

## MCP

AEGISCode supports MCP (Model Context Protocol) servers. Configure in `config.json`:

```json
{
  "mcpEnabled": true,
  "mcpServers": {
    "my-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@my/mcp-server"]
    }
  }
}
```

---

## Built by

**Niklas Borneklint** — [aegiscloud.org](https://aegiscloud.org) · [@aegisinfo](https://github.com/aegisinfo)

Part of the AEGIS ecosystem.
