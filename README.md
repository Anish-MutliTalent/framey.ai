# Framey AI

> Professional video, from a single sentence — built natively inside Adobe After Effects.

Framey is an AI **copilot** for motion graphics. You describe the video you want in
plain words — *"Hey Framey, make me a launch video for my product"* — and a team of
specialized agents builds it inside After Effects the way a motion designer would:
selecting layers, setting properties, animating, applying effects, and queuing renders.

The key difference from "AI video generators": **Framey doesn't generate pixels from
scratch.** It drives the same industry-grade editor studios already trust, so every
output is a real, editable `.aep` project file — not a black box.

## The four quality layers

1. **Native action** — every agent works through After Effects' own scripting & UI
   pathways, exactly as a human would.
2. **Deterministic replay** — every action is logged to `framey-action-log.jsonl` and
   can be re-run against a fresh driver (`npm run replay`). A result is never a lucky
   one-off.
3. **Automated quality checks** — before finalizing, Framey validates timing, alignment,
   and render integrity against professional standards.
4. **You** — the project file stays fully open; a human can review, tweak, or override
   any decision.

In Real AE mode the agent can also **write and run arbitrary ExtendScript** (the
[AE-agent](AE-agent-main/) approach) for full control, reads a rich comp dump (layers,
effects, keyframes, expressions, masks), and **checkpoints** project state so it can
revert on failure.

## The brain

Framey's agents are powered by a **MiniMax** model on **Fireworks AI** (OpenAI-compatible
endpoint), using function-calling to drive the editor. A Fireworks API key is required.

## Quickstart

```bash
npm install
npm run dev        # launches the Electron app
```

The AE driver defaults to the **Simulator** (no After Effects install needed). Add your
**Fireworks API key** in Settings (or `.env`), type a prompt (or click a suggestion),
and watch the agents build a real composition: a live timeline, an animated stage
preview, the action stream, and a quality report.

## Three run modes (Settings ▸)

| LLM | AE driver | What you get |
|---|---|---|
| **Fireworks · MiniMax** | **Simulator** | Real agent loop against the in-process comp model. No AE install needed. Needs a Fireworks API key. |
| **Fireworks · MiniMax** | **Real AE** | Real agents driving a real running After Effects. Load `ae/driver.jsx` (see below). |

Configure via the Settings panel or `.env` (copy `.env.example`):

```ini
FRAMEY_LLM=fireworks                 # always fireworks (MiniMax on Fireworks)
FRAMEY_BASE_URL=https://api.fireworks.ai/inference/v1
FRAMEY_API_KEY=your_key              # required
FRAMEY_MODEL=accounts/fireworks/models/minimax-m3
FRAMEY_AE_DRIVER=simulate            # simulate | extendscript
FRAMEY_BRIDGE_PORT=49321
```

## Connecting real After Effects

1. In Settings, set **After Effects driver → Real AE**.
2. Open After Effects.
3. **File ▸ Scripts ▸ Run Script File…** and pick `ae/driver.jsx`.

The script connects to Framey over `127.0.0.1:49321`, executes each command in an
undo group, and pushes the live comp state back. See [`ae/README_AE.md`](ae/README_AE.md).

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Renderer (React) — chat · live action stream · comp timeline │
│   preview · quality report · settings                         │
└──────────────▲───────────────────────────────────────────────┘
               │ IPC (framey:event stream)
┌──────────────┴───────────────────────────────────────────────┐
│ Main (Electron) — AgentRuntime                                │
│   • LLM: Fireworks (OpenAI-compatible) → MiniMax, tool-calling│
│     loop + specialist delegation (cuts / motion / sound / qc) │
│   • Tools → AECommand protocol + run_extendscript (model      │
│     writes & runs arbitrary ExtendScript, like a human)       │
│   • ActionLog (deterministic replay) · QualityChecks          │
│   • Checkpoints (save / revert project state)                 │
│   • AEDriver: Simulated (in-process) | ExtendScript (TCP)     │
└──────────────┬───────────────────────────────────────────────┘
               │ TCP bridge (newline JSON)
       ┌───────┴────────┐
       │ ae/driver.jsx   │  ← loaded inside After Effects
       │ ExtendScript    │
       └─────────────────┘
```

### Project layout

```
src/
  shared/protocol.ts        # AE command union + comp model + events (the contract)
  main/
    index.ts                # Electron entry
    ipc.ts                  # renderer ↔ main IPC
    bridge/
      aeDriver.ts           # driver interface + factory
      simulatedDriver.ts    # in-process AE model (no AE needed)
      extendscriptDriver.ts # real AE over TCP
      server.ts             # TCP bridge server
    agent/
      llm.ts                # Fireworks (OpenAI SDK) client
      tools.ts              # native AE tool surface + dispatch
      prompts.ts            # orchestrator + specialist prompts
      runtime.ts            # agent loop, delegation, logging, QC
      actionLog.ts          # JSONL log + replay
      quality.ts            # automated quality checks
      offlinePlanner.ts     # zero-credential deterministic build
  preload/index.ts          # safe contextBridge API
  renderer/                 # React UI (chat, action stream, comp preview, settings)
ae/driver.jsx               # ExtendScript driver for real After Effects
scripts/replay.ts           # npm run replay
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launch the app with hot reload. |
| `npm run build` | Build main + preload + renderer for production. |
| `npm run typecheck` | Type-check main and renderer. |
| `npm run replay` | Replay the last action log against a fresh simulator. |

## Why this matters

Every product, studio, and founder needs a launch video. Today the choice is slow and
expensive (weeks of expert labor) or fast and forgettable (AI slop). Framey makes
**professional the default** — the craft stays human, the labor becomes instant.
