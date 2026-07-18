// Automated quality checks — the "before anything is shown to you, Framey
// validates timing, alignment, and render integrity" layer.
//
// Runs against the live CompState (works in both simulate and extendscript
// modes) and returns a structured report the agent can act on.

import type { CompState, QCReport, QCCheck } from '../../shared/protocol'

export function runQualityCheck(comp: CompState | null): QCReport {
  if (!comp) {
    return {
      passed: false,
      checks: [
        {
          name: 'composition',
          passed: false,
          message: 'no active composition to check',
          severity: 'error'
        }
      ]
    }
  }

  const checks: QCCheck[] = []

  // duration sanity
  const durOk = comp.durationSeconds > 0 && comp.durationSeconds <= 600
  checks.push({
    name: 'duration',
    passed: durOk,
    message: `${comp.durationSeconds}s`,
    severity: durOk ? 'info' : 'warn'
  })

  // has content
  checks.push({
    name: 'has-layers',
    passed: comp.layers.length > 0,
    message: `${comp.layers.length} layer(s)`,
    severity: comp.layers.length > 0 ? 'info' : 'error'
  })

  for (const l of comp.layers) {
    // timing integrity
    if (l.inPoint >= l.outPoint) {
      checks.push({
        name: `timing:${l.name}`,
        passed: false,
        message: `inPoint ${l.inPoint}s >= outPoint ${l.outPoint}s`,
        severity: 'error'
      })
    } else if (l.outPoint > comp.durationSeconds + 0.001) {
      checks.push({
        name: `timing:${l.name}`,
        passed: false,
        message: `outPoint ${l.outPoint}s exceeds comp duration ${comp.durationSeconds}s`,
        severity: 'warn'
      })
    } else {
      checks.push({
        name: `timing:${l.name}`,
        passed: true,
        message: `${l.inPoint}s–${l.outPoint}s`,
        severity: 'info'
      })
    }

    // text on-canvas
    if (l.type === 'text' && l.position) {
      const [x, y] = l.position
      if (x < 0 || y < 0 || x > comp.width || y > comp.height) {
        checks.push({
          name: `text-pos:${l.name}`,
          passed: false,
          message: `text at (${x},${y}) may be off-canvas (${comp.width}x${comp.height})`,
          severity: 'warn'
        })
      }
    }

    // keyframes within comp duration + at least 2 per animated property
    for (const [path, kfs] of Object.entries(l.animatedProperties)) {
      if (kfs.length < 2) {
        checks.push({
          name: `anim:${l.name}:${path}`,
          passed: false,
          message: `only ${kfs.length} keyframe(s) — need >=2 to animate`,
          severity: 'warn'
        })
      }
      for (const k of kfs) {
        if (k.time < -0.001 || k.time > comp.durationSeconds + 0.001) {
          checks.push({
            name: `keyframe:${l.name}:${path}`,
            passed: false,
            message: `keyframe at ${k.time}s outside comp duration`,
            severity: 'warn'
          })
        }
      }
    }
  }

  // render integrity
  const hasRender = comp.renderQueue.length > 0
  checks.push({
    name: 'render-queue',
    passed: hasRender,
    message: hasRender ? `${comp.renderQueue.length} item(s) queued` : 'empty — call add_to_render_queue before render',
    severity: hasRender ? 'info' : 'warn'
  })
  for (const r of comp.renderQueue) {
    const defaulted = !r.outputPath || r.outputPath.endsWith('_render.mov')
    checks.push({
      name: `render-output:${r.outputPath}`,
      passed: !defaulted,
      message: defaulted ? `output path defaulted: ${r.outputPath}` : r.outputPath,
      severity: defaulted ? 'warn' : 'info'
    })
  }

  // project saved (open & editable)
  checks.push({
    name: 'project-saved',
    passed: !!comp.savedPath,
    message: comp.savedPath ?? 'not saved — call save_project',
    severity: comp.savedPath ? 'info' : 'warn'
  })

  const hasErrors = checks.some((c) => c.severity === 'error' && !c.passed)
  return { passed: !hasErrors, checks }
}
