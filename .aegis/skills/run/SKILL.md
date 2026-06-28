---
name: run
description: >
  Launch and drive the aegiscode terminal app in tmux to see a change working —
  send chat messages, capture the screen, test scrolling/windowing. Use whenever
  asked to run, start, test, or verify aegiscode (the CLI or the GUI's embedded
  CLI) actually works, not just that it type-checks.
allowed-tools:
  - Bash
disable-model-invocation: false
when_to_use: Verifying a change to aegiscode (CLI) by actually running it, reproducing a UI/streaming/scrolling bug, or confirming a fix works end-to-end before reporting done.
user-invocable: true
argument-hint: '[dev|binary]'
version: "1.0"
---

# Run aegiscode — tmux driver

This project is an Ink/React terminal app — there's no meaningful way to
"run" it other than launching it in a real terminal and driving it with
keystrokes. Always do this before claiming a fix works.

## Two ways to launch — pick deliberately

- **`npm run dev`** (`tsx src/main.tsx`) — reads `src/` live. Use this for
  quick iteration while editing source files.
- **`/home/neo/.local/bin/aegis`** — runs the **compiled** `dist/main.js`.
  This is what `aegiscode-gui` (Electron) also spawns. Source edits are
  invisible here until you rebuild.

**Gotcha that has caused real "it's not working" reports:** `dist/main.js`
does not auto-rebuild. If you've edited `src/` and want to test the actual
binary or the GUI's behavior, run `npm run build` first — otherwise you're
testing stale code and any fix will look like it didn't take effect.

## Launch + drive

```bash
tmux kill-session -t aegistest 2>/dev/null
tmux new-session -d -s aegistest -x 220 -y 30 "npm run dev"   # or: /home/neo/.local/bin/aegis
sleep 5
tmux capture-pane -t aegistest -p | tail -60
```

Send a message:

```bash
tmux send-keys -t aegistest "your message here" && sleep 1 && tmux send-keys -t aegistest Enter
sleep 12   # streaming responses take a few seconds — don't capture too early
tmux capture-pane -t aegistest -p | tail -60
```

**Quirk:** the first `Enter` right after typing sometimes doesn't submit —
the input box still shows the typed text with no "generating…" indicator.
If the status bar doesn't change after ~3s, send `Enter` again before
concluding something is broken.

## Reproducing scroll/windowing bugs

The message list only windows (hides earlier messages) when total estimated
lines exceed the viewport. A tall terminal (`-y 50`) may never trigger
windowing at all. Use a small one instead:

```bash
tmux new-session -d -s aegistest -x 220 -y 24 "npm run dev"
```

To check whether the view is actually at the true bottom (not just looks
like it), send `End` and diff the capture before/after — if the visible
messages change, the prior render was out of sync.

## Cleanup

Always `tmux kill-session -t aegistest 2>/dev/null` when done — don't leave
test sessions running.
