# AEGIS Code — Multi-Model AI Coding Agent

A terminal-based AI coding assistant with multi-model support, semantic memory, council voting, MCP, hooks, and cloud sync.

**BYOK (Bring Your Own Key)** — requires your own API keys.

---

## Features

- **Multi-Model Chat** — Anthropic, DeepSeek, Groq, OpenAI, Ollama (switch mid-session)
- **Semantic Memory** — persistent context across sessions
- **Council Voting** — 3 agents deliberate for better decisions
- **Multi-Agent Orchestration** — delegate tasks to specialized agents
- **MCP Server Support** — extend capabilities via the Model Context Protocol
- **Hooks System** — PreToolUse, PostToolUse, and more
- **Cloud Sync** — opt-in sync across devices
- **Themes** — default, light, dark, ocean, forest, sunset

---

## Requirements

| Runtime | Status |
|---------|--------|
| **Bun** | ✅ Recommended (faster installs & execution) |
| Node.js v22+ | ✅ Supported |

- At least **one API key** (Anthropic, OpenAI, DeepSeek, Groq, or local Ollama)

---

## Quick Install

```bash
git clone https://github.com/aegisinfo/aegiscode.git
cd aegiscode
bun install
bun run build
```

> 💡 Using Node.js? Replace `bun` with `npm` — e.g. `npm install`, `npm run build`.

---

## Configuration

### 1. Create environment file

```bash
cp .env.example .env
```

Edit `.env` with your API keys. See `.env.example` for all supported variables.

### 2. Initialize config (optional)

```bash
bun run start --init
```

This creates `~/.aegiscode/config.json` with default settings. Edit it directly to fine-tune.

### 3. Runtime config overrides

Set environment variables to override config values at runtime:

```bash
AEGIS_MODEL=claude AEGIS_THEME=ocean aegis
```

---

## Usage

### Interactive mode (default)

```bash
aegis
```

Start a conversation. Commands are prefixed with `/`:

| Command | Description |
|---------|-------------|
| `/model <id>` | Switch model mid-session |
| `/memory` | View or edit semantic memory |
| `/council` | Toggle council voting mode |
| `/sync` | Force cloud sync |
| `/help` | Show all commands |

### One-shot queries

```bash
aegis "explain the visitor pattern in Go"
```

### Session management

```bash
aegis --continue          # resume last session
aegis --session mysession # name your session
```

### Tool approval

```bash
aegis --yolo              # auto-approve all tool calls (use with care)
aegis --approve           # ask before each tool call (default)
```

---

## Development

```bash
# Start dev server with hot reload
bun run dev

# Build production bundle
bun run build

# Run tests
bun test
```

### Project structure

```
aegiscode/
├── src/              # Source code
│   ├── commands/     # Command handlers
│   ├── models/       # Model adapters
│   ├── tools/        # Tool implementations
│   ├── memory/       # Semantic memory engine
│   └── utils/        # Shared utilities
├── dist/             # Built output (gitignored)
├── hooks/            # Custom hook scripts
└── config/           # Default config templates
```

---

## Documentation

Full documentation, API reference, and guides at [aegiscloud.org](https://aegiscloud.org)

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built with ❤️ by the AEGIS team*
