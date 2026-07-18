// SimulatedAEDriver — a faithful in-process model of an After Effects project.
//
// Every command mutates a CompState exactly the way the real ExtendScript
// driver would, so the live timeline preview in the UI reflects real work,
// and an action log captured here replays identically against real AE.

import { randomUUID } from 'node:crypto'
import type {
  AECommand,
  AEResult,
  Color,
  CompState,
  Layer,
  Vec2
} from '../../shared/protocol'
import type { AEDriver, AEDriverCallbacks } from './aeDriver'

interface SimProject {
  comps: Map<string, CompState>
  activeCompId: string | null
  projectPath?: string
}

const BLACK: Color = [0, 0, 0]
const WHITE: Color = [1, 1, 1]

function center(comp: CompState): Vec2 {
  return [comp.width / 2, comp.height / 2]
}

function findLayer(comp: CompState, name: string): Layer | undefined {
  return comp.layers.find((l) => l.name === name)
}

function ok(summary: string, data?: unknown): AEResult {
  return { ok: true, summary, data }
}
function fail(error: string): AEResult {
  return { ok: false, summary: `failed: ${error}`, error }
}

export class SimulatedAEDriver implements AEDriver {
  readonly mode = 'simulate' as const
  private cb: AEDriverCallbacks
  private proj: SimProject = { comps: new Map(), activeCompId: null }
  private seq = 0
  private compSeq = 0
  private cpSeq = 0
  private checkpoints: { label: string; snapshot: SimProject }[] = []

  constructor(cb: AEDriverCallbacks) {
    this.cb = cb
  }

  setCallbacks(cb: AEDriverCallbacks): void {
    this.cb = cb
  }

  async init(): Promise<void> {
    this.cb.onConnection?.('simulated')
  }

  getCompState(): CompState | null {
    if (!this.proj.activeCompId) return null
    return this.proj.comps.get(this.proj.activeCompId) ?? null
  }

  // Resolve a comp by id, falling back to name — the LLM sometimes passes the
  // comp name where the compId is expected, and this keeps the build on track.
  private findComp(compId: string): CompState | undefined {
    return this.proj.comps.get(compId) ?? [...this.proj.comps.values()].find((c) => c.name === compId)
  }

  // Deep-clone a project for checkpoints.
  private cloneProject(p: SimProject): SimProject {
    const comps = new Map<string, CompState>()
    for (const [k, v] of p.comps.entries()) comps.set(k, structuredClone(v))
    return { comps, activeCompId: p.activeCompId, projectPath: p.projectPath }
  }

  private emit(): void {
    this.cb.onCompUpdate?.(this.getCompState())
  }

  private active(): CompState | null {
    return this.getCompState()
  }

  private nextName(base: string, comp: CompState): string {
    const taken = new Set(comp.layers.map((l) => l.name))
    if (!taken.has(base)) return base
    let i = 2
    while (taken.has(`${base} ${i}`)) i++
    return `${base} ${i}`
  }

  private addLayer(comp: CompState, partial: Omit<Layer, 'id' | 'index' | 'enabled' | 'inPoint' | 'outPoint' | 'animatedProperties' | 'effects'> & Partial<Pick<Layer, 'inPoint' | 'outPoint' | 'enabled'>>): Layer {
    const layer: Layer = {
      id: randomUUID(),
      index: 0,
      enabled: partial.enabled ?? true,
      inPoint: partial.inPoint ?? 0,
      outPoint: partial.outPoint ?? comp.durationSeconds,
      animatedProperties: {},
      effects: [],
      ...partial
    }
    // insert at top (index 0), shift others down
    comp.layers.forEach((l) => (l.index += 1))
    layer.index = 0
    comp.layers.unshift(layer)
    return layer
  }

  async execute(cmd: AECommand): Promise<AEResult> {
    this.seq++
    try {
      const r = await this.dispatch(cmd)
      if (this.mutates(cmd)) this.emit()
      return r
    } catch (e) {
      return fail((e as Error).message)
    }
  }

  private mutates(cmd: AECommand): boolean {
    return cmd.type !== 'get_comp_state'
  }

  private dispatch(cmd: AECommand): AEResult | Promise<AEResult> {
    switch (cmd.type) {
      case 'new_project':
        this.proj = { comps: new Map(), activeCompId: null }
        this.compSeq = 0
        return ok('new project created')

      case 'open_project': {
        this.proj.projectPath = cmd.path
        return ok(`opened project ${cmd.path}`)
      }

      case 'create_composition': {
        const id = 'comp-' + ++this.compSeq
        const comp: CompState = {
          id,
          name: cmd.name,
          width: cmd.width,
          height: cmd.height,
          frameRate: cmd.frameRate,
          durationSeconds: cmd.durationSeconds,
          bgColor: cmd.bgColor ?? BLACK,
          layers: [],
          markers: [],
          renderQueue: []
        }
        this.proj.comps.set(id, comp)
        this.proj.activeCompId = id
        return ok(`composition "${cmd.name}" created (compId=${id}, ${cmd.width}×${cmd.height} @ ${cmd.frameRate}fps, ${cmd.durationSeconds}s)`, { compId: id })
      }

      case 'add_solid_layer': {
        const comp = this.findComp(cmd.compId)
        if (!comp) return fail(`composition ${cmd.compId} not found`)
        const name = this.nextName(cmd.name, comp)
        const layer = this.addLayer(comp, {
          name,
          type: 'solid',
          color: cmd.color,
          width: cmd.width ?? comp.width,
          height: cmd.height ?? comp.height,
          position: center(comp),
          anchorPoint: [0, 0],
          scale: [100, 100],
          rotation: 0,
          opacity: 100
        })
        return ok(`solid layer "${name}" added`, { layerId: layer.id })
      }

      case 'add_text_layer': {
        const comp = this.findComp(cmd.compId)
        if (!comp) return fail(`composition ${cmd.compId} not found`)
        const name = this.nextName(cmd.name, comp)
        const layer = this.addLayer(comp, {
          name,
          type: 'text',
          text: cmd.text,
          fontSize: cmd.fontSize ?? 96,
          fontFamily: cmd.fontFamily ?? 'Arial',
          fillColor: cmd.fillColor ?? WHITE,
          position: cmd.position ?? center(comp),
          anchorPoint: cmd.anchorPoint ?? center(comp),
          scale: [100, 100],
          rotation: 0,
          opacity: 100
        })
        return ok(`text layer "${name}" added ("${cmd.text.slice(0, 32)}")`, { layerId: layer.id })
      }

      case 'add_rectangle_shape': {
        const comp = this.findComp(cmd.compId)
        if (!comp) return fail(`composition ${cmd.compId} not found`)
        const name = this.nextName(cmd.name, comp)
        const layer = this.addLayer(comp, {
          name,
          type: 'shape',
          color: cmd.fillColor ?? [1, 1, 1],
          width: cmd.size[0],
          height: cmd.size[1],
          position: cmd.position,
          anchorPoint: [cmd.size[0] / 2, cmd.size[1] / 2],
          scale: [100, 100],
          rotation: 0,
          opacity: 100
        })
        return ok(`rectangle "${name}" added (${cmd.size[0]}×${cmd.size[1]})`, { layerId: layer.id })
      }

      case 'add_footage_layer': {
        const comp = this.findComp(cmd.compId)
        if (!comp) return fail(`composition ${cmd.compId} not found`)
        const name = this.nextName(cmd.name ?? filePathBasename(cmd.filePath), comp)
        const layer = this.addLayer(comp, {
          name,
          type: 'footage',
          sourcePath: cmd.filePath,
          position: center(comp),
          anchorPoint: center(comp),
          scale: [100, 100],
          rotation: 0,
          opacity: 100,
          width: comp.width,
          height: comp.height
        })
        return ok(`footage layer "${name}" added`, { layerId: layer.id })
      }

      case 'add_audio_layer': {
        const comp = this.findComp(cmd.compId)
        if (!comp) return fail(`composition ${cmd.compId} not found`)
        const name = this.nextName(cmd.name ?? filePathBasename(cmd.filePath), comp)
        const start = cmd.startTime ?? 0
        const layer = this.addLayer(comp, {
          name,
          type: 'audio',
          sourcePath: cmd.filePath,
          position: [0, 0],
          inPoint: start,
          outPoint: comp.durationSeconds
        })
        return ok(`audio layer "${name}" added @ ${start}s`, { layerId: layer.id })
      }

      case 'add_null_layer': {
        const comp = this.findComp(cmd.compId)
        if (!comp) return fail(`composition ${cmd.compId} not found`)
        const name = this.nextName(cmd.name, comp)
        const layer = this.addLayer(comp, {
          name,
          type: 'null',
          position: center(comp),
          anchorPoint: center(comp),
          scale: [100, 100],
          rotation: 0,
          opacity: 100
        })
        return ok(`null layer "${name}" added`, { layerId: layer.id })
      }

      case 'set_property': {
        const comp = this.active()
        if (!comp) return fail('no active composition')
        const layer = findLayer(comp, cmd.layerName)
        if (!layer) return fail(`layer "${cmd.layerName}" not found`)
        applyStaticProperty(layer, cmd.propertyPath, cmd.value)
        return ok(`set ${cmd.propertyPath} on "${cmd.layerName}"`)
      }

      case 'set_keyframes': {
        const comp = this.active()
        if (!comp) return fail('no active composition')
        const layer = findLayer(comp, cmd.layerName)
        if (!layer) return fail(`layer "${cmd.layerName}" not found`)
        const kfs = [...cmd.keyframes].sort((a, b) => a.time - b.time)
        layer.animatedProperties[cmd.propertyPath] = kfs
        return ok(`animated ${cmd.propertyPath} on "${cmd.layerName}" (${kfs.length} keyframes)`)
      }

      case 'set_layer_timing': {
        const comp = this.active()
        if (!comp) return fail('no active composition')
        const layer = findLayer(comp, cmd.layerName)
        if (!layer) return fail(`layer "${cmd.layerName}" not found`)
        layer.inPoint = cmd.inPoint
        layer.outPoint = cmd.outPoint
        return ok(`"${cmd.layerName}" timing ${cmd.inPoint}s → ${cmd.outPoint}s`)
      }

      case 'apply_effect': {
        const comp = this.active()
        if (!comp) return fail('no active composition')
        const layer = findLayer(comp, cmd.layerName)
        if (!layer) return fail(`layer "${cmd.layerName}" not found`)
        layer.effects.push({
          name: cmd.effectName,
          properties: cmd.properties ?? {},
          enabled: true
        })
        return ok(`effect "${cmd.effectName}" applied to "${cmd.layerName}"`)
      }

      case 'add_marker': {
        const comp = this.active()
        if (!comp) return fail('no active composition')
        comp.markers.push({
          time: cmd.time,
          label: cmd.label,
          comment: cmd.comment,
          type: cmd.markerType
        })
        comp.markers.sort((a, b) => a.time - b.time)
        return ok(`marker "${cmd.label}" @ ${cmd.time}s`)
      }

      case 'set_work_area': {
        const comp = this.active()
        if (!comp) return fail('no active composition')
        comp.workArea = { start: cmd.start, end: cmd.end }
        return ok(`work area ${cmd.start}s → ${cmd.end}s`)
      }

      case 'precompose': {
        const comp = this.active()
        if (!comp) return fail('no active composition')
        const moved: Layer[] = []
        for (const name of cmd.layerNames) {
          const idx = comp.layers.findIndex((l) => l.name === name)
          if (idx >= 0) moved.push(comp.layers.splice(idx, 1)[0])
        }
        const preId = randomUUID()
        const pre: CompState = {
          id: preId,
          name: cmd.name,
          width: comp.width,
          height: comp.height,
          frameRate: comp.frameRate,
          durationSeconds: comp.durationSeconds,
          bgColor: comp.bgColor,
          layers: moved.map((l, i) => ({ ...l, index: i })),
          markers: [],
          renderQueue: []
        }
        this.proj.comps.set(preId, pre)
        this.addLayer(comp, {
          name: cmd.name,
          type: 'footage',
          sourcePath: `precomp://${preId}`,
          position: center(comp),
          anchorPoint: center(comp),
          scale: [100, 100],
          rotation: 0,
          opacity: 100,
          width: comp.width,
          height: comp.height
        })
        return ok(`precomposed ${moved.length} layer(s) into "${cmd.name}" (compId=${preId})`, { compId: preId })
      }

      case 'save_project': {
        this.proj.projectPath = cmd.path
        const comp = this.active()
        if (comp) comp.savedPath = cmd.path
        return ok(`project saved to ${cmd.path}`)
      }

      case 'add_to_render_queue': {
        const comp = this.findComp(cmd.compId)
        if (!comp) return fail(`composition ${cmd.compId} not found`)
        comp.renderQueue.push({
          compId: cmd.compId,
          outputModule: cmd.outputModule ?? 'Lossless',
          outputPath: cmd.outputPath ?? `${comp.name}_render.mov`,
          status: 'queued'
        })
        return ok(`"${comp.name}" added to render queue (${cmd.outputModule ?? 'Lossless'})`)
      }

      case 'render': {
        let n = 0
        for (const comp of this.proj.comps.values()) {
          for (const item of comp.renderQueue) {
            if (item.status === 'queued' || item.status === 'rendering') {
              item.status = 'done'
              n++
            }
          }
        }
        return ok(`rendered ${n} item(s)`)
      }

      case 'get_comp_state': {
        const comp = cmd.compId ? this.proj.comps.get(cmd.compId) ?? null : this.active()
        if (!comp) return fail('no active composition')
        return ok(`comp state: ${comp.layers.length} layer(s)`, comp)
      }

      case 'run_extendscript':
        return fail(
          'run_extendscript is only available in Real After Effects mode. Switch the AE driver to "Real AE" in Settings, or use the structured tools (create_composition, add_text_layer, set_layer_timing, animate_property, apply_effect, …).'
        )

      case 'checkpoint': {
        const label = cmd.label || `cp-${++this.cpSeq}`
        this.checkpoints.push({ label, snapshot: this.cloneProject(this.proj) })
        return ok(`checkpoint "${label}" saved`, { label })
      }

      case 'revert_checkpoint': {
        if (!this.checkpoints.length) return fail('no checkpoints to revert to')
        let cp: { label: string; snapshot: SimProject } | undefined
        if (cmd.label) cp = this.checkpoints.find((c) => c.label === cmd.label)
        else cp = this.checkpoints[this.checkpoints.length - 1]
        if (!cp) return fail(`checkpoint "${cmd.label}" not found`)
        this.proj = this.cloneProject(cp.snapshot)
        return ok(`reverted to checkpoint "${cp.label}"`)
      }

      default:
        return fail(`unknown command: ${(cmd as { type: string }).type}`)
    }
  }

  async dispose(): Promise<void> {
    /* nothing to clean up */
  }
}

function filePathBasename(p: string): string {
  const slash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  const tail = slash >= 0 ? p.slice(slash + 1) : p
  return tail.replace(/\.[^.]+$/, '') || 'Footage'
}

// Map an AE property path (e.g. "Transform.Position") to a typed Layer field.
function applyStaticProperty(
  layer: Layer,
  path: string,
  value: number | Vec2 | number[] | string | boolean
): void {
  switch (path) {
    case 'Transform.Position':
      if (Array.isArray(value)) layer.position = [value[0], value[1]]
      break
    case 'Transform.Scale':
      if (Array.isArray(value)) layer.scale = [value[0], value[1]]
      break
    case 'Transform.Rotation':
      layer.rotation = typeof value === 'number' ? value : layer.rotation
      break
    case 'Transform.Opacity':
      layer.opacity = typeof value === 'number' ? value : layer.opacity
      break
    case 'Transform.Anchor Point':
    case 'Transform.AnchorPoint':
      if (Array.isArray(value)) layer.anchorPoint = [value[0], value[1]]
      break
    case 'Source Text':
      layer.text = typeof value === 'string' ? value : layer.text
      break
    case 'Color':
      if (Array.isArray(value)) layer.color = [value[0], value[1], value[2]]
      break
    case 'Fill Color':
      if (Array.isArray(value)) layer.fillColor = [value[0], value[1], value[2]]
      break
    case 'Size':
      if (Array.isArray(value)) {
        layer.width = value[0]
        layer.height = value[1]
      }
      break
    default:
      // store arbitrary paths so the preview + replay stay faithful
      layer.extraProps = layer.extraProps ?? {}
      layer.extraProps[path] = value as number | Vec2 | number[] | string | boolean
  }
}
