---
name: optimization
description: Pre-build optimization triage to avoid duplicate work, choose the right approach, and prevent over-engineering. Use BEFORE writing any code for a new feature, module, or service. Trigger on phrases like "build", "create", "implement", "add", "make a", "write a", "set up".
allowed-tools:
  - Read
  - Grep
  - Bash
disable-model-invocation: false
when_to_use: User asks to build, create, implement, add, set up, or write something new. Also when refactoring or adding significant functionality.
---

Ask these 7 questions **before** writing any code. Don't just answer — scan the project, grep for existing patterns, check available packages.

### Q1 — Already built?
Search the current project, sibling projects, npm/cargo/pip. Don't rebuild what exists.

### Q2 — Environment?
Browser / Node / Electron / mobile / server / edge CLI. Affects architecture choices.

### Q3 — Production vs prototype?
- **Production**: needs error handling, logging, tests, edge cases
- **Prototype**: simplest thing that works, no over-engineering

### Q4 — Performance?
High load / large data / streaming needs → plan for caching, batching, streaming. Otherwise simple is fine.

### Q5 — Architecture fit?
Does it fit existing patterns (commands, agents, tools, hooks, skills)? Or needs a standalone module?

### Q6 — Monetization?
Could this be a paid feature? Flag if it belongs behind Pro/Enterprise. Don't build paid features as free-by-default.

### Q7 — Prediction?
Estimate concrete impact: users reached, conversion lift, retention improvement, or developer velocity gained.

---

**Output format**: Brief answers to all 7, then a clear recommendation:
- Package exists → install it, write minimal wrapper
- Similar code → refactor + reuse
- Prototype → simplest possible implementation
- Production → plan architecture first
- Unknown domain → write a spike/PoC first
