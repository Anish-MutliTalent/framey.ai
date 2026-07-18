import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'

const SUGGESTIONS = [
  { k: 'Launch', t: 'Make me a launch video for my product' },
  { k: 'Social ad', t: 'A 15s social ad for a coffee brand called Bricklane' },
  { k: 'Logo sting', t: 'A logo sting reveal for a startup named Nimbus' },
  { k: 'Explainer', t: 'A 20s explainer with a title, three feature cards, and a CTA' }
]

export default function ChatPanel(): JSX.Element {
  const messages = useStore((s) => s.messages)
  const input = useStore((s) => s.input)
  const setInput = useStore((s) => s.setInput)
  const send = useStore((s) => s.send)
  const busy = useStore((s) => s.busy)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <h2>Describe the video you want</h2>
            <p>Framey builds it natively inside After Effects — a real, editable project file, not generated pixels.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s.t} className="chip" onClick={() => send(s.t)} disabled={busy}>
                  <div className="k">{s.k}</div>
                  <div>{s.t}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.role !== 'user' && <div className="role">{m.role === 'assistant' ? 'Framey' : 'notice'}</div>}
              {m.text}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Hey Framey, make me a launch video for my product…"
          disabled={busy}
        />
        <div className="chat-input-row">
          <span className="hint">Enter to send · Shift+Enter for a new line</span>
          <button className="btn primary" onClick={() => send()} disabled={busy || !input.trim()}>
            Build
          </button>
        </div>
      </div>
    </div>
  )
}
