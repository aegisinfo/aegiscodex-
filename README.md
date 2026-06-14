# aegiscode

**aegiscode remembers your project between sessions — so you never have to re-explain your stack, decisions, or context.**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/demo.svg">
  <img src="assets/demo.svg" alt="aegiscode terminal demo — animated" width="100%"/>
</picture>

Multi-model terminal coding assistant. Works with Claude, OpenAI, DeepSeek, Groq, Gemini and Ollama. BYOK — your keys, your cost.

> ### Semantic memory — €2/month
> The AI remembers your project, stack, and decisions across every session.  
> Subscribe at **[aegiscloud.org](https://aegiscloud.org)**, then activate with one command:
>
> ```
> /memory activate <token>
> ```

---

## Install

> Requires **Node.js >= 22**. Install via [nvm](https://github.com/nvm-sh/nvm): `nvm install 22`

> **Important:** Use [Kitty](https://sw.kovidgoyal.net/kitty/) (recommended) or a modern terminal emulator (Ghostty, WezTerm, Alacritty, iTerm2, Windows Terminal) for the best experience. Older terminals may have rendering issues with scrolling and alternate-screen mode.

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

## Desktop GUI

aegiscode ships with an Electron desktop app — same AI, same memory, with a native window.

**Install:**

```bash
git clone https://github.com/aegisinfo/aegiscode
cd aegiscode
bash gui/install.sh
```

`gui/install.sh` installs dependencies and creates an `ags` launcher in `~/.local/bin`.

**Launch:**

```bash
ags
```

**Tabs:**

| Tab | Description |
|-----|-------------|
| Terminal ⌨ | Full aegiscode session with true color and resize support |
| History ◷ | Browse and resume past sessions |
| Memory ⬡ | Search stored memory entries, view stats, manage subscription |
| Cloud ⬡ | Cloud sync status and API key |
| Settings ⚙ | Configure API key and model |

Memory and cloud sync are activated by pasting your API key in the Memory tab after subscribing at [aegiscloud.org](https://aegiscloud.org).

---

## First run

Run `aegis` — if no API keys are configured, an interactive setup guide launches automatically:

```
◆ aegiscode — Setup

  Keys are saved to ~/.aegiscode/.env

  Select provider:
❯ Anthropic (Claude)    ANTHROPIC_API_KEY
  OpenAI (GPT)          OPENAI_API_KEY
  DeepSeek              DEEPSEEK_API_KEY
  Groq                  GROQ_API_KEY
  Google Gemini         GEMINI_API_KEY
  Ollama (local)        (no key needed)
```

Pick a provider, paste your key, and optionally add more. Keys are saved to `~/.aegiscode/.env` and the app starts immediately.

**Or configure manually** — create `~/.aegiscode/.env`:

```env
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
GROQ_API_KEY=YOUR_GROQ_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Only add the keys for providers you want to use. aegiscode picks them up automatically.

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

Config lives at `~/.aegiscode/config.json`. It is created automatically on first run.

API keys are read from `~/.aegiscode/.env` — you don't need to put them in `config.json`.

To add a custom model inside the app:

```
/model add openrouter-mixtral "Mixtral 8x7B" mistralai/mixtral-8x7b-instruct https://openrouter.ai/api/v1 sk-or-...
```

---

## Built-in models

| ID | Model | Provider |
|----|-------|----------|
| `claude-fable-5` | claude-fable-5 | Anthropic |
| `claude-sonnet-4` | claude-sonnet-4-6 | Anthropic |
| `claude-opus-4` | claude-opus-4-8 | Anthropic |
| `claude-haiku-4` | claude-haiku-4-5-20251001 | Anthropic |
| `openai-gpt-5.5` | gpt-5.5 | OpenAI |
| `openai-gpt-4o` | gpt-4o | OpenAI |
| `openai-o3` | o3 | OpenAI |
| `deepseek-chat` | deepseek-chat | DeepSeek |
| `deepseek-reasoner` | deepseek-reasoner | DeepSeek |
| `groq-llama` | llama-3.3-70b-versatile | Groq |
| `groq-deepseek` | qwen-qwq-32b | Groq |
| `gemini-2.5-pro` | gemini-2.5-pro | Google |
| `gemini-2.5-flash` | gemini-2.5-flash | Google |
| `ollama-local` | llama3.2 | Ollama (local) |

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
| `/multi <task>` | | Run task across multiple agents in parallel |
| `/multiyolo <task>` | | Same as /multi with auto-approved tool calls |
| `/build <description>` | `/forge` | Build an app with multiple AI models in parallel |
| `/council <question>` | | Multi-model majority vote |
| `/research <question>` | | Multi-agent research |
| `/memory` | | Manage semantic memory |
| `/skills` | `/sk` | List loaded skills |
| `/hooks` | | View and manage hooks |
| `/version` | `/v` | Show version info |

---

## /build — parallel multi-model app builder

`/build` decomposes your task into components, assigns each to the best available AI model, and builds everything simultaneously.

```
/build a REST API for a todo app with PostgreSQL
/build a CLI tool that summarizes git commits
/build a Flask web app with login and dashboard
```

**How it works:**

1. **Plan** — primary model produces a component tree (JSON)
2. **Build** — all components built in parallel, each by the best model for that role:
   - DeepSeek → backend, algorithms (`DEEPSEEK_API_KEY`)
   - GPT-4o → frontend, UI (`OPENAI_API_KEY`)
   - Llama via Groq → tests, docs (`GROQ_API_KEY`)
   - Primary model → architecture, integration
3. **Sync** — summary of files written and how to run the app

All agents write real files to your current directory. The more API keys you have configured, the more models work in parallel.

---

## Tools

aegiscode can read, write, and execute files in your project. Tool permissions are configured per-project in `.aegiscode/settings.json`:

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

Persistent cross-session memory requires an active subscription (€2/month).

**How to activate:**

1. Subscribe at [aegiscloud.org](https://aegiscloud.org)
2. Check your inbox for the activation token
3. Run inside aegiscode:

```
/memory activate <token>
```

Once active, the AI remembers your stack, past decisions, and project context across every session — no re-explaining needed.

```
/memory stats    # usage and quota
/memory clear    # wipe stored memory
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

aegiscode supports MCP (Model Context Protocol) servers. Configure in `~/.aegiscode/config.json`:

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

Part of the ÆGIS ecosystem.
