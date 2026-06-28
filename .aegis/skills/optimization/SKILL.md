---
name: optimization
description: >
  Ask targeted questions before starting to build something new, to avoid
  duplicate work, choose the right approach, and prevent over-engineering.
  Use BEFORE writing any code for a new feature, module, or service — especially
  when the task involves building something from scratch or adding a significant
  new component. Trigger on phrases like "build", "create", "implement", "add",
  "make a", "write a", "set up".
allowed-tools:
  - Read
  - Grep
  - Bash
disable-model-invocation: false
when_to_use: User asks to build, create, implement, add, set up, or write something new. Also when refactoring or adding significant functionality.
user-invocable: true
argument-hint: '<task description>'
version: "1.0"
---

# Optimization — Pre-Build Checklist

Before writing any code, answer these questions to choose the smartest path.
Work through them quickly — most answers are one line. Skip any that clearly don't apply.

## Q1 — Already built?

- Search the current project: does a similar function, class, or module already exist?
- Have you built something like this in another project (local or online)?
- Is there an existing **npm/pip/cargo package** that solves exactly this problem?
  - If yes: use the package instead of building from scratch.
  - Search: `npm search <keyword>`, `pypi.org`, `crates.io`, `pkg.go.dev`.

## Q2 — Environment & deployment

- Where does the code run? → `browser` / `Node.js` / `Electron` / `mobile` / `server` / `edge`
- Will it be deployed online (Railway, Vercel, Cloudflare) or run locally?
- Are there platform constraints (e.g. no file I/O in browser, no DOM in Node)?

## Q3 — Production vs prototype

- Is this for **production** (stable, tested, edge cases handled) or **prototype** (fast, hacky OK)?
- Does it need error handling, logging, retry logic?
- How critical is this code — can it fail without consequences?

## Q4 — Performance requirements

- Expected high load, large data volumes, or fast response times?
- Does a simple implementation suffice, or do you need caching, batching, streaming?

## Q5 — Architecture fit

- Does this fit the existing code structure, or should it be standalone?
- Is there a pattern in the project this should follow (e.g. service layer, hook-based, event-driven, command pattern)?
- Should it be reusable by other parts of the project?

## Q6 — Monetization

Time is invested in these projects (aegiscode, aegiscode-gui, rex, aegis1) — prioritize features that strengthen revenue. Every time a new feature is built, ask:

- Could this be a **paid feature**, or strengthen an existing payment flow (Stripe/memory-subscription), instead of being free by default?
- Is there a natural place to show an upgrade/CTA without being intrusive?
- Does this move a measurable goal (more paying users, lower churn, higher conversion) or is it just "nice to have"?
- If the feature is free today — is that a deliberate choice (e.g. to drive adoption) or just an oversight?

If unclear: flag it to the user before building a free-by-default version of something that could reasonably belong in the paid offering.

## Q7 — Prediction (marketing impact)

After presenting the recommendation (and after the feature is built), give a short marketing prediction directed at the user:

- What could this feature concretely mean — more users, higher conversion, better retention, stronger differentiation from competitors?
- Is there a natural "hook" to market the feature with (a short pitch, a comparison, a demo moment)?
- Is the effect likely **large**, **moderate**, or **marginal**? Be honest, don't overstate.

Keep the prediction to 1-2 sentences, concrete and not overly salesy.

---

## Recommendation

Based on the answers above, choose **one** path:

| Situation | Approach |
|---|---|
| Package solves it | Install the package, write minimal wrapper |
| Similar code exists | Refactor and reuse |
| Prototype, low risk | Simplest possible implementation, no over-engineering |
| Production, high load | Plan architecture briefly before coding |
| New unknown domain | Write a small spike/proof-of-concept first |

Present the recommendation in **one sentence** and then start coding.
