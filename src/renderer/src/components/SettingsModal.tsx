import { useState } from 'react'
import { useStore } from '../state/store'
import type { FrameySettings } from '../../../shared/protocol'

const DEFAULTS: FrameySettings = {
  llm: 'fireworks',
  baseURL: 'https://api.fireworks.ai/inference/v1',
  apiKey: '',
  model: 'accounts/fireworks/models/minimax-m3',
  aeDriver: 'simulate',
  bridgePort: 49321
}

export default function SettingsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const [s, setS] = useState<FrameySettings>(settings ?? DEFAULTS)

  const set = (p: Partial<FrameySettings>) => setS((x) => ({ ...x, ...p }))
  const save = async () => {
    await update(s)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="modal-body">
          <div className="field">
            <label>LLM provider</label>
            <div className="seg">
              <button className="btn primary" disabled>
                Fireworks · MiniMax
              </button>
            </div>
            <span className="hint">OpenAI-compatible endpoint. A Fireworks API key is required — the agent will not run without one.</span>
          </div>

          <div className="field">
            <label>Fireworks base URL</label>
            <input value={s.baseURL} onChange={(e) => set({ baseURL: e.target.value })} />
          </div>

          <div className="field">
            <label>Fireworks API key</label>
            <input
              type="password"
              value={s.apiKey}
              onChange={(e) => set({ apiKey: e.target.value })}
              placeholder="fw-…"
            />
            <span className="hint">Stored locally in framey-settings.json. Required — used to call MiniMax on Fireworks.</span>
          </div>

          <div className="field">
            <label>Model</label>
            <input value={s.model} onChange={(e) => set({ model: e.target.value })} />
            <span className="hint">Default: accounts/fireworks/models/minimax-m3 (524K ctx, vision).</span>
          </div>

          <div className="field">
            <label>After Effects driver</label>
            <div className="seg">
              <button className={`btn ${s.aeDriver === 'simulate' ? 'primary' : ''}`} onClick={() => set({ aeDriver: 'simulate' })}>
                Simulator
              </button>
              <button className={`btn ${s.aeDriver === 'extendscript' ? 'primary' : ''}`} onClick={() => set({ aeDriver: 'extendscript' })}>
                Real AE
              </button>
            </div>
            <span className="hint">
              {s.aeDriver === 'extendscript'
                ? `Load ae/driver.jsx in After Effects (File ▸ Scripts ▸ Run Script File). It connects on port ${s.bridgePort}.`
                : 'No After Effects needed — fully runnable with a faithful in-process comp model.'}
            </span>
          </div>

          {s.aeDriver === 'extendscript' && (
            <div className="field">
              <label>Bridge port</label>
              <input
                type="number"
                value={s.bridgePort}
                onChange={(e) => set({ bridgePort: Number(e.target.value) || 49321 })}
              />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
