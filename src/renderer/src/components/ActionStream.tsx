import { useEffect, useRef } from 'react'
import { useStore, type FeedItem } from '../state/store'
import type { QCReport } from '../../../shared/protocol'

function shortArgs(args: Record<string, unknown>): string {
  const keys = ['name', 'text', 'effectName', 'propertyPath', 'durationSeconds', 'time', 'compId', 'specialist', 'path', 'outputModule']
  const parts: string[] = []
  for (const k of keys) {
    if (k in args) {
      let v: unknown = args[k]
      if (typeof v === 'string' && v.length > 30) v = v.slice(0, 30) + '…'
      parts.push(`${k}=${JSON.stringify(v)}`)
    }
  }
  return parts.length ? parts.join(' ') : ''
}

function FeedRow({ f }: { f: FeedItem }): JSX.Element {
  if (f.kind === 'tool-call') {
    return (
      <div className="feed-item tool-call">
        <span className="agent">{f.agent}</span> ▸ <span className="tool">{f.tool}</span> {shortArgs(f.args)}
      </div>
    )
  }
  if (f.kind === 'tool-result') {
    return (
      <div className="feed-item tool-result">
        {'  ↳ '}
        {f.ok ? <span className="ok">ok</span> : <span className="fail">fail</span>} <span className="summary">{f.summary}</span>
      </div>
    )
  }
  return (
    <div className="feed-item action">
      <span className="seq">#{f.entry.seq}</span> <span className="agent">{f.entry.agent}</span>{' '}
      <span className="tool">{f.entry.command}</span>{' '}
      {f.entry.ok ? null : <span className="fail">failed </span>}
      <span className="summary">{f.entry.resultSummary}</span>
    </div>
  )
}

function QcBox({ report }: { report: QCReport }): JSX.Element {
  const fails = report.checks.filter((c) => !c.passed)
  return (
    <div className={`qc-box ${report.passed ? 'pass' : 'fail'}`}>
      {report.passed ? 'Quality check: PASS' : `Quality check: ${fails.length} issue(s)`}
      <div className="qc-checks">
        {fails.length === 0 ? (
          <div className="ok">all checks passed</div>
        ) : (
          fails.map((c) => (
            <div key={c.name} className={c.severity}>
              {c.severity.toUpperCase()} {c.name}: {c.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function ActionStream(): JSX.Element {
  const feed = useStore((s) => s.feed)
  const phases = useStore((s) => s.phases)
  const qc = useStore((s) => s.qc)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [feed])

  const phaseList = Object.values(phases)

  return (
    <div className="actions">
      <div className="section-head">
        <h3>Action Stream</h3>
        <span className="meta">deterministic · replayable</span>
      </div>
      {phaseList.length > 0 && (
        <div className="phases">
          {phaseList.map((p) => (
            <span key={p.name} className={`phase-chip ${p.status}`}>
              <span className="who">{p.specialist}</span>
              {p.name}
              {p.status === 'running' ? ' …' : ' ✓'}
            </span>
          ))}
        </div>
      )}
      <div className="feed">
        {feed.length === 0 ? (
          <div className="feed-item" style={{ color: 'var(--muted-2)' }}>
            Native AE operations will appear here as the agents work.
          </div>
        ) : (
          feed.map((f) => <FeedRow key={f.id} f={f} />)
        )}
        <div ref={endRef} />
      </div>
      {qc && <QcBox report={qc} />}
    </div>
  )
}
