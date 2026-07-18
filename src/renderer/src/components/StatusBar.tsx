import { useStore } from '../state/store'

export default function StatusBar({ onOpenSettings }: { onOpenSettings: () => void }): JSX.Element {
  const status = useStore((s) => s.status)
  const conn = useStore((s) => s.connection)

  const aeClass = conn ? conn.ae : 'disconnected'
  const aeLabel = conn
    ? conn.ae === 'simulated'
      ? 'AE: Simulator'
      : conn.ae === 'connected'
        ? 'AE: Connected'
        : conn.ae === 'connecting'
          ? 'AE: Connecting…'
          : 'AE: Disconnected'
    : 'AE: —'
  const llmLabel = conn ? 'Fireworks' : ''
  const modelLabel = conn ? conn.model.replace('accounts/fireworks/models/', '') : ''
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <div className="statusbar">
      <div className="brand">
        <div className="logo" />
        <h1>Framey AI</h1>
        <span className="tag">native AE copilot</span>
      </div>
      <span className={`pill status-${status}`}>
        <span className="dot" />
        {statusLabel}
      </span>
      <span className={`pill ${aeClass}`}>
        <span className="dot" />
        {aeLabel}
      </span>
      <span className="pill model">{`${llmLabel} · ${modelLabel}`}</span>
      <span className="spacer" />
      <button className="btn ghost" onClick={onOpenSettings}>
        Settings
      </button>
    </div>
  )
}
