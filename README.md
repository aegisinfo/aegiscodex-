# ⬡ AEGIS Code

En terminalbaserad AI-kodningsassistent med stöd för flera modeller, semantiskt minne, multi-agent-orkestrering, MCP, hooks och molnsynk.

**BYOK (Bring Your Own Key)** — du behöver dina egna API-nycklar.

---

## Funktioner

- **Multi-Model Chat** — Anthropic, DeepSeek, Groq, OpenAI, Ollama (växla mitt i session)
- **Ink-baserat UI** — React-rendrerad terminal med syntaxhighlighting, teman och interaktiva väljare
- **Semantiskt Minne** — beständig kontext över sessioner (kräver token)
- **Council Voting** — 3 modellers majoritetsbeslut med `/council`
- **Multi-Agent-Orkestrering** — `/multi` för att delegera till 4 specialiserade agenter (arkitekt, implementerare, granskare, felsökare)
- **Research Council** — `/research` för att utforska frågor ur 4 perspektiv (analytiker, arkitekt, etiker, pragmatiker)
- **Tool Execution Pipeline** — stages för discovery, behörighet, hooks, bekräftelse, exekvering, post-hooks och formattering
- **Hooks System** — PreToolUse, PostToolUse med mera, konfigurerbara per event
- **Skills System** — ladda SKILL.md-filer från användare/projekt/inbyggda källor
- **MCP Server Support** — utöka kapaciteten via Model Context Protocol
- **Molnsynk** — opt-in-synkronisering via aegiscloud.org
- **Teman** — default, light, dark, ocean, forest, sunset
- **Kompaktering** — automatisk och manuell kontextkompaktering för att spara tokens
- **Kommando** — `/copy`, `/compact`, `/thinking`, `/status`, `/skills`, `/hooks`, `/yolo`, `/model`, `/theme`, `/memory`, `/cloud`, `/billing` med flera

---

## Krav

| Körning | Status |
|---------|--------|
| **Bun** | ✅ Rekommenderas (snabbare installation & exekvering) |
| Node.js v22+ | ✅ Stöds |

- Minst **en API-nyckel** (Anthropic, OpenAI, DeepSeek, Groq eller lokal Ollama)

---

## Snabbinstallation

```bash
git clone https://github.com/aegisinfo/aegiscode.git
cd aegiscode
npm install
npm run build
```

---

## Konfiguration

### 1. Skapa miljöfil

```bash
cp .env.example .env
```

Redigera `.env` med dina API-nycklar. Se `.env.example` för alla variabler.

### 2. Initiera config (valfritt)

```bash
npm run start -- --init
```

Skapar `~/.aegiscode/config.json` med standardinställningar. Redigera direkt för finjustering.

### 3. Konfigurationsprioritet

1. Standardvärden
2. Användarkonfig (`~/.aegiscode/config.json`)
3. Projektkonfig (`./.aegiscode/config.json`)
4. Miljövariabler (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`)
5. CLI-argument (`--api-key`, `--base-url`, `--model`)

---

## Användning

### Interaktivt läge (standard)

```bash
aegis
```

Starta en konversation. Kommandon prefixas med `/`:

| Kommando | Beskrivning |
|----------|-------------|
| `/model <id>` | Byt modell mitt i session |
| `/theme [namn]` | Byt tema |
| `/memory` | Visa eller redigera semantiskt minne |
| `/memory activate <token>` | Aktivera minne med prenumerations-token |
| `/memory load <url\|path>` | Ladda minne från moln eller lokal fil |
| `/memory clear` | Rensa alla minnen |
| `/memory stats` | Visa minnesstatistik |
| `/council <fråga>` | Skicka fråga till 3 modeller för omröstning |
| `/multi <uppgift>` | Orkestrera 4 specialiserade agenter |
| `/research <fråga>` | Forskningsråd med 4 perspektiv |
| `/cloud key <api_key>` | Sätt din aegiscloud.org API-nyckel |
| `/cloud sync on\|off` | Aktivera/inaktivera molnsynk |
| `/skills [namn\|refresh]` | Hantera skills |
| `/hooks [status\|list]` | Hantera hooks |
| `/compact` | Tvinga kontextkompaktering |
| `/copy [N\|last\|list\|raw]` | Kopiera kodblock eller assistantsvar |
| `/thinking` | Expandera/dölj tankeblock |
| `/yolo [on\|off]` | Aktivera/inaktivera YOLO-läge |
| `/status` | Visa sessionsstatus |
| `/help` | Visa alla kommandon |

### Engångsfrågor

```bash
aegis "förklara visitor-mönstret i Go"
```

### Sessionshantering

```bash
aegis --continue            # återuppta senaste sessionen
aegis --session mittnamn    # namnge din session
```

### Säkerhetslägen

```bash
aegis --yolo                # auto-godkänn alla verktygsanrop (använd med försiktighet)
aegis --approve             # fråga före varje verktygsanrop (standard)
```

### Debug-läge

```bash
aegis --debug
```

---

## Projektstruktur

```
aegiscode/
├── src/
│   ├── agent/              # Agent- och orkestreringslogik
│   │   └── orchestrator/   # CouncilAgent, OrchestratorAgent
│   ├── cli/                # CLI-konfiguration, yargs, middleware
│   ├── config/             # ConfigManager, konfigurationshantering
│   ├── context/            # ContextManager, kompaktering, storage
│   │   └── storage/        # CacheStore, JSONLStore, MemoryStore, PersistentStore
│   ├── hooks/              # HookExecutor, HookManager, Matcher
│   ├── mcp/                # MCP-klient, registry, health monitor
│   ├── memory/             # SharedMemory, AgentMemoryBus, DriveSync
│   ├── prompts/            # Promptbyggare, planner, standardprompts
│   ├── services/           # ChatService, CloudSync, VersionChecker
│   ├── skills/             # SkillLoader, SkillRegistry
│   ├── slash-commands/     # Inbyggda kommandon och custom command-system
│   │   └── custom/         # CustomCommandExecutor, loader, registry
│   ├── store/              # Zustand store (app, config, session, focus, command slices)
│   ├── tools/              # Verktygssystem
│   │   ├── builtin/        # Inbyggda verktyg: bash, read, write, edit, grep, glob, skill
│   │   ├── execution/      # ExecutionPipeline med stages
│   │   └── validation/     # PermissionChecker, SensitiveFileDetector
│   ├── ui/                 # Ink-baserat React UI
│   │   ├── components/     # Markdown-rendering, layout, dialoger, input
│   │   ├── themes/         # Teman (default, dark, light, ocean, forest, sunset)
│   │   ├── focus/          # FocusManager för tangentbordsnavigation
│   │   └── hooks/          # React hooks (commandHistory, confirmation, inputBuffer m.fl.)
│   └── utils/              # Debug, environment
├── dist/                   # Byggd utdata (gitignorerad)
├── hooks/                  # Anpassade hook-skript
└── static/                 # Statiska resurser
```

---

## Tool Execution Pipeline

Varje verktygsanrop passerar genom en pipeline med 7 stages:

1. **Discovery** — hitta tillgängliga verktyg
2. **Permission** — kontrollera om verktyget är tillåtet
3. **Hook** — kör PreToolUse-hooks
4. **Confirmation** — begär användarens godkännande (om inte YOLO)
5. **Execution** — exekvera verktyget
6. **PostHook** — kör PostToolUse-hooks
7. **Formatting** — formattera resultatet för modellen

---

## Utveckling

```bash
# Starta utvecklingsserver med hot reload
npm run dev

# Bygg produktionsbundle
npm run build

# Typkontroll
npm run typecheck

# Kör tester
npm run test:prompts
npm run test:tools
npm run test:pipeline
npm run test:context
npm run test:mcp
npm run test:store
```

---

## Dokumentation

Full dokumentation, API-referens och guider på [aegiscloud.org](https://aegiscloud.org)

---

## Licens

MIT — se [LICENSE](LICENSE)

---

*Byggt med ❤️ av AEGIS-teamet*
