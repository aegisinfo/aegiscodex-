---
name: aegiscode
description: A multi-model terminal coding assistant with cross-session memory, MCP support, and a desktop GUI. Use for any task involving the aegiscode CLI or its Electron-based GUI.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
user-invocable: true
---

# AEGIS Code — ÆGIS CLI Coding Assistant

Multi-model terminal coding assistant supporting Claude, OpenAI, DeepSeek, Groq, Gemini, and Ollama. Bring-your-own-key model.

## Architecture

### CLI (`aegis`) — `/home/neo/aegiscode`
- **Runtime**: Node.js ≥22, built with esbuild
- **UI**: React Ink (terminal-based TUI with tabs, syntax highlighting)
- **Entry**: `src/main.tsx` → compiled to `dist/main.js`
- **Install**: `bash install.sh` → creates `aegis` wrapper in `~/.local/bin`

### Desktop GUI — `/home/neo/aegiscode-gui`
- **Platform**: Electron 33, packaged with electron-builder
- **Integration**: Embeds the CLI via `gui/run-gui.cjs` (bundles backend in `extraResources`)
- **Terminal**: xterm.js + node-pty-prebuilt-multiarch for shell integration
- **Build targets**: Linux (deb), Windows (msi), macOS (dmg)

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run with tsx watcher |
| `npm run build` | Production esbuild bundle |
| `npm run gui` | Launch in GUI mode via Electron |
| `aegis` | Interactive mode |
| `aegis --continue` | Resume last session |
| `aegis --resume <id>` | Resume specific session |

## Project Structure

```
aegiscode/
├── src/                  # TypeScript source (React Ink TUI)
├── dist/                 # Compiled output
├── gui/                  # Electron desktop GUI bridge
├── static/               # Static assets
├── assets/               # Demo images
├── esbuild.mjs           # Build config
├── main.js               # Package main (GUI side)
└── install.sh            # Install script
```

## Skills & Tools System

- Skills stored in `.aegis/skills/<name>/SKILL.md` (project-level, Git-tracked)
- Global skills in `~/.aegis/skills/<name>/SKILL.md`
- Tool permissions configured per-project in `.aegis/settings.json`
- MCP server support via `~/.aegiscode/config.json`
- Invoke via `/skills`, load with `/load <name>`, create with `/skill <name> <description>`

## Desktop GUI Tabs

| Tab | Purpose |
|-----|---------|
| Terminal ⌨ | Full aegiscode session with true color |
| History ◷ | Browse/resume past sessions |
| Memory ⬡ | Semantic memory management |
| Cloud ⬡ | Cloud sync & API keys |
| Settings ⚙ | API key / model config |

## Building the GUI

```bash
# Linux
npm run build:linux       # → dist/aegiscode-gui*.deb

# Windows
npm run build:win         # → dist/aegiscode-gui*.msi

# macOS
npm run build:mac         # → dist/aegiscode-gui*.dmg
```

The GUI bundles the CLI `dist/` as an `extraResource`, along with `sql.js`, `@xenova/transformers`, and `@huggingface/jinja` for local AI features.

## Cross-Session Memory

Requires subscription at [aegiscloud.org](https://aegiscloud.org). Activate via `/memory activate <token>`. Stores project context across sessions — no re-explaining needed.

## MCP (Model Context Protocol)

Configure in `~/.aegiscode/config.json`:

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

## Environment

API keys in `~/.aegiscode/.env`:
```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```
