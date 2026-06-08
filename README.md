# AEGIS Code — Multi-Model AI Coding Agent

A terminal-based AI coding assistant with multi-model support, semantic memory, council voting, MCP, hooks, and cloud sync.

**BYOK (Bring Your Own Key)** — requires your own API keys.

## Features

- Multi-model chat (Anthropic, DeepSeek, Groq, OpenAI, Ollama)
- Semantic memory across sessions
- Council voting (3 agents deliberate)
- Multi-agent orchestration
- MCP server support
- Hooks system (PreToolUse, PostToolUse, etc.)
- Cloud sync (opt-in)
- Themes (default, light, dark, ocean, forest, sunset)

## Requirements

- **Node.js** v22+ or **Bun**
- At least one API key

## Quick Install

```bash
git clone https://github.com/aegisinfo/aegiscode.git
cd aegiscode
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and add your API keys, or use config file:

```bash
npx aegiscode --init
# edit ~/.aegiscode/config.json
```

See `.env.example` for all supported environment variables.

## Usage

```bash
aegis                          # start interactive mode
aegis -m claude                # switch model
aegis "your question"          # one-shot question
aegis --continue               # resume last session
aegis --yolo                   # auto-approve all tools
```

Switch model mid-session: `/model <model-id>`

## More

See full documentation at [aegiscloud.org](https://aegiscloud.org)

## License

MIT
