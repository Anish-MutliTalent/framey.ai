# Framey AI — After Effects setup (real AE mode)

Framey drives a real, running Adobe After Effects through this folder's
`driver.jsx`. You only need this if you set the **After Effects driver** to
**Real AE** in Settings. Otherwise Framey runs in the built-in **Simulator**,
which needs no AE install.

## One-time setup

1. Open After Effects (2020 or newer recommended).
2. Start the Framey app and set **After Effects driver → Real AE** in Settings
   (port defaults to `49321` — must match `FRAMEY_BRIDGE_PORT` if you changed it).
3. In After Effects, choose **File ▸ Scripts ▸ Run Script File…** and select
   `ae/driver.jsx` in this repo.

The script connects to Framey on `127.0.0.1:49321`, logs to
`~/Desktop/framey-driver.log`, and keeps itself alive with a scheduled poll. It
auto-reconnects if the host restarts — just re-run the script if AE restarts.

## What it does

For every command the agents issue, `driver.jsx`:

- opens an undo group in AE (`Framey: <command>`), so every action is undoable
  by the human — the "project file stays fully open" guarantee;
- executes it through AE's scripting DOM (create comp, add layers, set/animate
  properties, apply effects, markers, render queue, render);
- returns an `AEResult`;
- pushes the full `CompState` back to Framey (layers, effects + their params,
  keyframes, expressions, masks) so the timeline + stage preview mirror the real comp.

Beyond the structured commands, the agent can:

- **`run_extendscript`** — write and run arbitrary ExtendScript in one undo group, for
  full control (build a whole element or the whole piece in one continuous script).
- **`checkpoint` / `revert_checkpoint`** — save `.aep` copies into
  `_framey_checkpoints/` next to the project and revert on failure.

## Notes & limits

- **Effect names**: AE's `addProperty` wants the *match name* (e.g.
  `ADBE Gaussian Blur 2`), not the display name ("Gaussian Blur"). If an effect
  fails, the action log will say so; give the agent the match name.
- ExtendScript is single-threaded; the driver polls the socket every 150 ms so
  AE's UI stays responsive.
- Driving AE requires the Framey app to be running (it hosts the TCP bridge).

## Deterministic replay

Every AE command is appended to `framey-action-log.jsonl`. Re-run it any time:

```bash
npm run replay   # replays the last run against a fresh simulator
```
