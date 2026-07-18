import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import type { CompState, Keyframe, Layer, Vec2 } from '../../../shared/protocol'

// ── keyframe sampling (linear; eased clips shown as dots on the timeline) ───
function lerp(a: unknown, b: unknown, f: number): number | number[] | string {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * f
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.map((v, i) => v + (((b as number[])[i] ?? v) - v) * f)
  }
  return (b as number | number[] | string) ?? a
}

function sample(kfs: Keyframe[], t: number): number | number[] | string {
  if (kfs.length === 0) return 0
  if (t <= kfs[0].time) return kfs[0].value
  const last = kfs[kfs.length - 1]
  if (t >= last.time) return last.value
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]
    const b = kfs[i + 1]
    if (t >= a.time && t <= b.time) {
      const f = (t - a.time) / Math.max(0.0001, b.time - a.time)
      return lerp(a.value, b.value, f)
    }
  }
  return last.value
}

function asVec(v: unknown, fb: Vec2): Vec2 {
  return Array.isArray(v) ? [Number(v[0]) || 0, Number(v[1]) || 0] : fb
}
function asNum(v: unknown, fb: number): number {
  return typeof v === 'number' ? v : fb
}
function rgb(c: [number, number, number] | undefined, fb = '#cccccc'): string {
  if (!c) return fb
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`
}

interface Transform {
  pos: Vec2
  scale: Vec2
  opacity: number
  rotation: number
}

function transformAt(l: Layer, t: number, comp: CompState): Transform {
  const ap = l.animatedProperties
  const center: Vec2 = [comp.width / 2, comp.height / 2]
  return {
    pos: ap['Transform.Position'] ? asVec(sample(ap['Transform.Position'], t), center) : l.position ?? center,
    scale: ap['Transform.Scale'] ? asVec(sample(ap['Transform.Scale'], t), [100, 100]) : l.scale ?? [100, 100],
    opacity: ap['Transform.Opacity'] ? asNum(sample(ap['Transform.Opacity'], t), 100) : l.opacity ?? 100,
    rotation: ap['Transform.Rotation'] ? asNum(sample(ap['Transform.Rotation'], t), 0) : l.rotation ?? 0
  }
}

function LayerView({ layer, t, comp }: { layer: Layer; t: number; comp: CompState }): JSX.Element {
  const tr = transformAt(layer, t, comp)
  const op = Math.max(0, Math.min(1, tr.opacity / 100))
  const sx = tr.scale[0] / 100
  const sy = tr.scale[1] / 100
  const tfm = `translate(${tr.pos[0]} ${tr.pos[1]}) rotate(${tr.rotation}) scale(${sx} ${sy})`
  const common = { opacity: op, transform: tfm }

  if (layer.type === 'text') {
    const fs = (layer.fontSize ?? 96) * 1 // scale applied via transform
    return (
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={layer.fontFamily ?? 'Arial'}
        fontSize={fs}
        fill={rgb(layer.fillColor, '#ffffff')}
        {...common}
      >
        {layer.text ?? ''}
      </text>
    )
  }

  if (layer.type === 'solid' || layer.type === 'shape') {
    const w = layer.width ?? comp.width
    const h = layer.height ?? comp.height
    const fill = layer.type === 'shape' ? rgb(layer.color, '#ffffff') : rgb(layer.color, '#444')
    return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} {...common} />
  }

  if (layer.type === 'footage') {
    const w = (layer.width ?? comp.width * 0.6)
    const h = (layer.height ?? comp.height * 0.6)
    return (
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill="#1d1d29"
        stroke="#444"
        strokeDasharray="14 10"
        strokeWidth={3}
        {...common}
      />
    )
  }

  if (layer.type === 'null') {
    return (
      <rect x={-40} y={-40} width={80} height={80} fill="none" stroke="#ffb020" strokeDasharray="8 8" strokeWidth={3} {...common} />
    )
  }

  // audio — no visual stage presence
  return <></>
}

export default function CompPreview(): JSX.Element {
  const comp = useStore((s) => s.comp)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [stageW, setStageW] = useState(420)
  const raf = useRef<number | undefined>(undefined)
  const lastTs = useRef<number>(0)

  // reset when comp changes
  useEffect(() => {
    setTime(0)
    setPlaying(false)
  }, [comp?.id])

  // measure stage width
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setStageW(Math.min(560, Math.max(220, el.clientWidth - 28)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // playback
  useEffect(() => {
    if (!playing || !comp) return
    const dur = comp.durationSeconds
    lastTs.current = performance.now()
    const tick = (now: number) => {
      const dt = (now - lastTs.current) / 1000
      lastTs.current = now
      setTime((prev) => {
        let nt = prev + dt
        if (nt >= dur) nt = 0
        return nt
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [playing, comp])

  if (!comp) {
    return (
      <div className="preview">
        <div className="section-head">
          <h3>Composition</h3>
          <span className="meta">no comp yet</span>
        </div>
        <div className="stage-wrap">
          <div className="stage-empty">Your composition will appear here — a live timeline and animated stage preview of the real AE project.</div>
        </div>
      </div>
    )
  }

  const dur = comp.durationSeconds
  const pct = dur > 0 ? (time / dur) * 100 : 0
  const stageH = Math.round((stageW * comp.height) / comp.width)
  const layersBottomUp = [...comp.layers].sort((a, b) => b.index - a.index)
  const ticks = Math.min(12, Math.max(4, Math.round(dur)))
  const tickStep = dur / ticks

  return (
    <div className="preview">
      <div className="section-head">
        <h3>Composition</h3>
        <span className="meta">
          {comp.name} · {comp.width}×{comp.height} · {comp.frameRate}fps · {dur}s · {comp.layers.length} layers
        </span>
        <span className="spacer" />
        <span className="meta">{comp.savedPath ? 'saved' : 'unsaved'}</span>
      </div>

      <div className="stage-wrap" ref={wrapRef}>
        <svg className="stage" width={stageW} height={stageH} viewBox={`0 0 ${comp.width} ${comp.height}`}>
          <rect x={0} y={0} width={comp.width} height={comp.height} fill={rgb(comp.bgColor, '#000')} />
          {layersBottomUp.map((l) => (
            <LayerView key={l.id} layer={l} t={time} comp={comp} />
          ))}
        </svg>
      </div>

      <div className="timeline-wrap">
        <div className="tl-ruler">
          <span style={{ width: 120, flexShrink: 0 }} />
          <div className="tl-lane" style={{ background: 'transparent' }}>
            {Array.from({ length: ticks + 1 }).map((_, i) => (
              <span key={i} style={{ position: 'absolute', left: `${(i * tickStep) / dur * 100}%`, transform: 'translateX(-50%)' }}>
                {i * tickStep}s
              </span>
            ))}
            <div className="tl-playhead" style={{ left: `${pct}%` }} />
          </div>
        </div>

        {comp.layers.map((l) => {
          const lpct = dur > 0 ? (l.inPoint / dur) * 100 : 0
          const wpct = dur > 0 ? Math.max(0.5, ((l.outPoint - l.inPoint) / dur) * 100) : 100
          const allKfs = Object.values(l.animatedProperties).flat()
          return (
            <div className="tl-row" key={l.id}>
              <span className="tl-label">
                <span className={`tl-bar ${l.type}`} style={{ position: 'static', width: 10, height: 10, display: 'inline-block', borderRadius: 2 }} />
                {l.name}
              </span>
              <div className="tl-lane">
                <div className={`tl-bar ${l.type}`} style={{ left: `${lpct}%`, width: `${wpct}%` }} />
                {allKfs.map((k, i) => (
                  <div key={i} className="tl-kf" style={{ left: `${(k.time / dur) * 100}%` }} />
                ))}
                <div className="tl-playhead" style={{ left: `${pct}%` }} />
              </div>
            </div>
          )
        })}

        {comp.markers.length > 0 && (
          <div className="tl-marker-row">
            <span style={{ width: 120, flexShrink: 0 }} />
            <div className="tl-lane" style={{ background: 'transparent' }}>
              {comp.markers.map((m, i) => (
                <div key={i} className={`tl-marker ${m.type === 'sound' ? 'sound' : ''}`} style={{ left: `${(m.time / dur) * 100}%` }} title={`${m.label} @ ${m.time}s`} />
              ))}
              <div className="tl-playhead" style={{ left: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="scrubber">
        <button className="btn play-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? '❚❚' : '►'}
        </button>
        <input
          type="range"
          min={0}
          max={dur}
          step={0.01}
          value={time}
          onChange={(e) => {
            setPlaying(false)
            setTime(Number(e.target.value))
          }}
        />
        <span className="t">{time.toFixed(2)}s / {dur}s</span>
      </div>
    </div>
  )
}
