// The agent's tool surface — native After Effects operations.
//
// Each tool maps 1:1 to an AECommand (or, for the three meta-tools, to a
// runtime helper). These are the only actions any agent can take, which means
// everything the agents do is logged, replayable, and runs identically in the
// simulator or against real AE.

import type { AECommand, AEResult, CompState, QCReport } from '../../shared/protocol'
import type { ToolDef } from './llm'

// ── shared schema fragments ────────────────────────────────────────────────
const colorSchema = {
  type: 'array',
  items: { type: 'number' },
  minItems: 3,
  maxItems: 3,
  description: 'RGB color, each channel 0..1. e.g. white=[1,1,1], black=[0,0,0].'
}
const vec2Schema = {
  type: 'array',
  items: { type: 'number' },
  minItems: 2,
  maxItems: 2,
  description: '[x, y] in pixels.'
}
const valueSchema = {
  type: ['number', 'array', 'string', 'boolean'],
  description: 'The property value: a number, [x,y] or [r,g,b] array, string, or boolean.'
}
const keyframeSchema = {
  type: 'object',
  properties: {
    time: { type: 'number', description: 'seconds' },
    value: { ...valueSchema, description: 'value at this time' },
    easingIn: { type: 'string', enum: ['linear', 'bezier', 'hold'], description: 'optional' },
    easingOut: { type: 'string', enum: ['linear', 'bezier', 'hold'], description: 'optional' }
  },
  required: ['time', 'value']
}

function t(name: string, description: string, parameters: Record<string, unknown>): ToolDef {
  return { type: 'function', function: { name, description, parameters } }
}

const compIdParam = { type: 'string', description: 'ID of the target composition (from create_composition).' }
const layerNameParam = { type: 'string', description: 'Name of the target layer.' }

// ── tool definitions ───────────────────────────────────────────────────────
export const AGENT_TOOLS: ToolDef[] = [
  t('new_project', 'Start a fresh, empty After Effects project.', {
    type: 'object',
    properties: {},
    required: []
  }),
  t(
    'create_composition',
    'Create a new composition (the canvas/timeline the video is built in). Pass a preset for a standard resolution, or set width/height explicitly. Returns its compId.',
    {
      type: 'object',
      properties: {
        name: { type: 'string' },
        preset: {
          type: 'string',
          enum: ['landscape_1080p', 'social_9x16', 'square_1080', 'landscape_4k', 'vertical_4x5'],
          description: 'Standard resolution preset. landscape_1080p=1920x1080 (default), social_9x16=1080x1920 (Reels/Stories), square_1080=1080x1080, landscape_4k=3840x2160, vertical_4x5=1080x1350. Overrides width/height.'
        },
        width: { type: 'integer', description: 'pixels; optional if preset is given (default 1920)' },
        height: { type: 'integer', description: 'pixels; optional if preset is given (default 1080)' },
        frameRate: { type: 'integer', description: 'fps, default 30' },
        durationSeconds: { type: 'number', description: 'total length in seconds' },
        bgColor: colorSchema
      },
      required: ['name', 'durationSeconds']
    }
  ),
  t('add_solid_layer', 'Add a solid-color full-comp layer (backgrounds, color washes).', {
    type: 'object',
    properties: {
      compId: compIdParam,
      name: { type: 'string' },
      color: colorSchema,
      width: { type: 'integer', description: 'optional; defaults to comp width' },
      height: { type: 'integer', description: 'optional; defaults to comp height' }
    },
    required: ['compId', 'name', 'color']
  }),
  t('add_text_layer', 'Add a text layer (titles, callouts, logo wordmark).', {
    type: 'object',
    properties: {
      compId: compIdParam,
      name: { type: 'string' },
      text: { type: 'string' },
      fontSize: { type: 'integer', description: 'optional, default 96' },
      fontFamily: { type: 'string', description: 'optional, default Arial' },
      fillColor: colorSchema,
      position: vec2Schema,
      anchorPoint: vec2Schema
    },
    required: ['compId', 'name', 'text']
  }),
  t('add_rectangle_shape', 'Add a rectangle shape layer (bars, cards, lower-thirds, backplates).', {
    type: 'object',
    properties: {
      compId: compIdParam,
      name: { type: 'string' },
      position: vec2Schema,
      size: vec2Schema,
      fillColor: colorSchema,
      strokeColor: colorSchema,
      strokeWidth: { type: 'number' }
    },
    required: ['compId', 'name', 'position', 'size']
  }),
  t('add_footage_layer', 'Import a media file (image/video) and add it as a layer.', {
    type: 'object',
    properties: {
      compId: compIdParam,
      filePath: { type: 'string', description: 'absolute path to the media file' },
      name: { type: 'string', description: 'optional layer name' }
    },
    required: ['compId', 'filePath']
  }),
  t('add_audio_layer', 'Add an audio file as a layer at a given start time.', {
    type: 'object',
    properties: {
      compId: compIdParam,
      filePath: { type: 'string', description: 'absolute path to the audio file' },
      name: { type: 'string' },
      startTime: { type: 'number', description: 'seconds, default 0' }
    },
    required: ['compId', 'filePath']
  }),
  t('add_null_layer', 'Add a null layer (a parent for grouping/animating other layers).', {
    type: 'object',
    properties: { compId: compIdParam, name: { type: 'string' } },
    required: ['compId', 'name']
  }),
  t(
    'set_property',
    'Set a property to a static value. Common paths: "Transform.Position", "Transform.Scale", "Transform.Opacity", "Transform.Rotation", "Transform.Anchor Point", "Source Text", "Color", "Size".',
    {
      type: 'object',
      properties: {
        compId: compIdParam,
        layerName: layerNameParam,
        propertyPath: { type: 'string' },
        value: valueSchema
      },
      required: ['compId', 'layerName', 'propertyPath', 'value']
    }
  ),
  t(
    'animate_property',
    'Animate a property across time with keyframes. Prefer eased motion. Same property paths as set_property.',
    {
      type: 'object',
      properties: {
        compId: compIdParam,
        layerName: layerNameParam,
        propertyPath: { type: 'string' },
        keyframes: { type: 'array', items: keyframeSchema, minItems: 2 }
      },
      required: ['compId', 'layerName', 'propertyPath', 'keyframes']
    }
  ),
  t('set_layer_timing', 'Set a layer in/out point in seconds (trimming).', {
    type: 'object',
    properties: {
      compId: compIdParam,
      layerName: layerNameParam,
      inPoint: { type: 'number' },
      outPoint: { type: 'number' }
    },
    required: ['compId', 'layerName', 'inPoint', 'outPoint']
  }),
  t('apply_effect', 'Apply an effect to a layer (e.g. "Gaussian Blur", "Glow", "CC Light Sweep", "Tint", "Noise HLS").', {
    type: 'object',
    properties: {
      compId: compIdParam,
      layerName: layerNameParam,
      effectName: { type: 'string' },
      properties: { type: 'object', description: 'optional effect parameter overrides' }
    },
    required: ['compId', 'layerName', 'effectName']
  }),
  t('add_marker', 'Add a comp marker (beat/scene/SFX cue).', {
    type: 'object',
    properties: {
      compId: compIdParam,
      time: { type: 'number' },
      label: { type: 'string' },
      comment: { type: 'string' },
      type: { type: 'string', enum: ['chapter', 'web', 'comment', 'sound'] }
    },
    required: ['compId', 'time', 'label']
  }),
  t('set_work_area', 'Set the comp work area (the render span).', {
    type: 'object',
    properties: { compId: compIdParam, start: { type: 'number' }, end: { type: 'number' } },
    required: ['compId', 'start', 'end']
  }),
  t('precompose', 'Move selected layers into a new subcomposition (precomp).', {
    type: 'object',
    properties: {
      compId: compIdParam,
      layerNames: { type: 'array', items: { type: 'string' } },
      name: { type: 'string' }
    },
    required: ['compId', 'layerNames', 'name']
  }),
  t('save_project', 'Save the After Effects project (.aep).', {
    type: 'object',
    properties: { path: { type: 'string', description: 'absolute .aep path' } },
    required: ['path']
  }),
  t('add_to_render_queue', 'Add a composition to the render queue.', {
    type: 'object',
    properties: {
      compId: compIdParam,
      outputModule: { type: 'string', description: 'e.g. "Lossless", "H.264"' },
      outputPath: { type: 'string', description: 'output file path' }
    },
    required: ['compId']
  }),
  t('render', 'Render everything in the render queue.', { type: 'object', properties: {}, required: [] }),
  t(
    'run_extendscript',
    'Write and run arbitrary ExtendScript in After Effects for full control — build, animate, and apply effects in ONE continuous script, exactly like a human motion designer writing a script. Real AE mode only. Runs in an undo group; keep it self-contained. ExtendScript is ES3 (no const/let/arrow functions/template literals).',
    {
      type: 'object',
      properties: { code: { type: 'string', description: 'ExtendScript source. Use app, app.project.activeItem, app.project.activeItem.selectedLayers, etc.' } },
      required: ['code']
    }
  ),
  t('checkpoint', 'Save a named checkpoint of the current project state. Use before risky or multi-step operations so you can revert.', {
    type: 'object',
    properties: { label: { type: 'string', description: 'optional label' } },
    required: []
  }),
  t('revert_checkpoint', 'Revert the project to the last checkpoint (or a named one). Use if something went wrong.', {
    type: 'object',
    properties: { label: { type: 'string', description: 'optional checkpoint label; defaults to the latest' } },
    required: []
  }),
  t('inspect_comp', 'Read the current state of a composition (layers, timing, animation, effects) so you can act on real state.', {
    type: 'object',
    properties: { compId: { ...compIdParam, description: 'optional; defaults to the active comp' } },
    required: []
  }),
  t('run_quality_check', 'Run automated quality checks (timing, alignment, render integrity) on the comp. Returns a pass/fail report.', {
    type: 'object',
    properties: { compId: { ...compIdParam, description: 'optional; defaults to the active comp' } },
    required: []
  }),
  t(
    'delegate_specialist',
    'Delegate a craft phase to a specialist agent: "cuts" (cuts & pacing), "motion" (VFX/motion graphics/transitions), "sound" (sound design), or "qc" (run + fix quality checks). The specialist runs and reports back.',
    {
      type: 'object',
      properties: {
        specialist: { type: 'string', enum: ['cuts', 'motion', 'sound', 'qc'] },
        task: { type: 'string', description: 'a concrete instruction for the specialist' }
      },
      required: ['specialist', 'task']
    }
  )
]

// Specialists get every tool EXCEPT delegate_specialist (no recursion).
export const SPECIALIST_TOOLS: ToolDef[] = AGENT_TOOLS.filter(
  (td) => td.function.name !== 'delegate_specialist'
)

// ── tool dispatch ───────────────────────────────────────────────────────────
export interface ToolRuntime {
  runCommand(agent: string, cmd: AECommand): Promise<AEResult>
  runQualityCheck(compId?: string): Promise<QCReport>
  delegate(specialist: string, task: string): Promise<string>
}

export interface ToolContext {
  agent: string
  runtime: ToolRuntime
}

const PRESET_DIMS: Record<string, [number, number]> = {
  landscape_1080p: [1920, 1080],
  social_9x16: [1080, 1920],
  square_1080: [1080, 1080],
  landscape_4k: [3840, 2160],
  vertical_4x5: [1080, 1350]
}

function asCmd(name: string, a: Record<string, unknown>): AECommand | null {
  switch (name) {
    case 'new_project':
      return { type: 'new_project' }
    case 'create_composition': {
      let width = a.width ? Number(a.width) : undefined
      let height = a.height ? Number(a.height) : undefined
      if (a.preset && PRESET_DIMS[String(a.preset)]) {
        const [pw, ph] = PRESET_DIMS[String(a.preset)]
        width = width ?? pw
        height = height ?? ph
      }
      return {
        type: 'create_composition',
        name: String(a.name),
        width: width ?? 1920,
        height: height ?? 1080,
        frameRate: a.frameRate ? Number(a.frameRate) : 30,
        durationSeconds: Number(a.durationSeconds),
        bgColor: a.bgColor as [number, number, number] | undefined
      }
    }
    case 'add_solid_layer':
      return {
        type: 'add_solid_layer',
        compId: String(a.compId),
        name: String(a.name),
        color: a.color as [number, number, number],
        width: a.width ? Number(a.width) : undefined,
        height: a.height ? Number(a.height) : undefined
      }
    case 'add_text_layer':
      return {
        type: 'add_text_layer',
        compId: String(a.compId),
        name: String(a.name),
        text: String(a.text),
        fontSize: a.fontSize ? Number(a.fontSize) : undefined,
        fontFamily: a.fontFamily ? String(a.fontFamily) : undefined,
        fillColor: a.fillColor as [number, number, number] | undefined,
        position: a.position as [number, number] | undefined,
        anchorPoint: a.anchorPoint as [number, number] | undefined
      }
    case 'add_rectangle_shape':
      return {
        type: 'add_rectangle_shape',
        compId: String(a.compId),
        name: String(a.name),
        position: a.position as [number, number],
        size: a.size as [number, number],
        fillColor: a.fillColor as [number, number, number] | undefined,
        strokeColor: a.strokeColor as [number, number, number] | undefined,
        strokeWidth: a.strokeWidth ? Number(a.strokeWidth) : undefined
      }
    case 'add_footage_layer':
      return {
        type: 'add_footage_layer',
        compId: String(a.compId),
        filePath: String(a.filePath),
        name: a.name ? String(a.name) : undefined
      }
    case 'add_audio_layer':
      return {
        type: 'add_audio_layer',
        compId: String(a.compId),
        filePath: String(a.filePath),
        name: a.name ? String(a.name) : undefined,
        startTime: a.startTime ? Number(a.startTime) : undefined
      }
    case 'add_null_layer':
      return { type: 'add_null_layer', compId: String(a.compId), name: String(a.name) }
    case 'set_property':
      return {
        type: 'set_property',
        compId: String(a.compId),
        layerName: String(a.layerName),
        propertyPath: String(a.propertyPath),
        value: a.value as number | [number, number] | number[] | string | boolean
      }
    case 'animate_property':
      return {
        type: 'set_keyframes',
        compId: String(a.compId),
        layerName: String(a.layerName),
        propertyPath: String(a.propertyPath),
        keyframes: a.keyframes as any[]
      }
    case 'set_layer_timing':
      return {
        type: 'set_layer_timing',
        compId: String(a.compId),
        layerName: String(a.layerName),
        inPoint: Number(a.inPoint),
        outPoint: Number(a.outPoint)
      }
    case 'apply_effect':
      return {
        type: 'apply_effect',
        compId: String(a.compId),
        layerName: String(a.layerName),
        effectName: String(a.effectName),
        properties: a.properties as Record<string, number | string | boolean | number[]> | undefined
      }
    case 'add_marker':
      return {
        type: 'add_marker',
        compId: String(a.compId),
        time: Number(a.time),
        label: String(a.label),
        comment: a.comment ? String(a.comment) : undefined,
        markerType: a.type as 'chapter' | 'web' | 'comment' | 'sound' | undefined
      }
    case 'set_work_area':
      return { type: 'set_work_area', compId: String(a.compId), start: Number(a.start), end: Number(a.end) }
    case 'precompose':
      return {
        type: 'precompose',
        compId: String(a.compId),
        layerNames: a.layerNames as string[],
        name: String(a.name)
      }
    case 'save_project':
      return { type: 'save_project', path: String(a.path) }
    case 'add_to_render_queue':
      return {
        type: 'add_to_render_queue',
        compId: String(a.compId),
        outputModule: a.outputModule ? String(a.outputModule) : undefined,
        outputPath: a.outputPath ? String(a.outputPath) : undefined
      }
    case 'render':
      return { type: 'render' }
    case 'run_extendscript':
      return { type: 'run_extendscript', code: String(a.code) }
    case 'checkpoint':
      return { type: 'checkpoint', label: a.label ? String(a.label) : undefined }
    case 'revert_checkpoint':
      return { type: 'revert_checkpoint', label: a.label ? String(a.label) : undefined }
    case 'inspect_comp':
      return { type: 'get_comp_state', compId: a.compId ? String(a.compId) : undefined }
    case 'run_quality_check':
    case 'delegate_specialist':
      return null
    default:
      return null
  }
}

export interface ToolExecResult {
  ok: boolean
  summary: string
  data?: unknown
}

export async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  if (name === 'delegate_specialist') {
    const summary = await ctx.runtime.delegate(String(rawArgs.specialist), String(rawArgs.task))
    return { ok: true, summary }
  }
  if (name === 'run_quality_check') {
    const report = await ctx.runtime.runQualityCheck(rawArgs.compId ? String(rawArgs.compId) : undefined)
    return { ok: report.passed, summary: formatQC(report), data: report }
  }
  const cmd = asCmd(name, rawArgs)
  if (!cmd) return { ok: false, summary: `unknown tool: ${name}` }
  const result = await ctx.runtime.runCommand(ctx.agent, cmd)
  if (name === 'inspect_comp' && result.ok && result.data) {
    return { ok: true, summary: formatComp(result.data as CompState), data: result.data }
  }
  return { ok: result.ok, summary: result.summary, data: result.data }
}

// ── formatters (compact, for LLM tool results) ─────────────────────────────
export function formatComp(comp: CompState): string {
  const lines: string[] = []
  lines.push(
    `Comp "${comp.name}" — ${comp.width}x${comp.height} @ ${comp.frameRate}fps, ${comp.durationSeconds}s, ${comp.layers.length} layer(s).`
  )
  for (const l of comp.layers) {
    const anim = Object.keys(l.animatedProperties)
    const animStr = anim.length ? ` | animated: ${anim.join(', ')}` : ''
    const fx = l.effects.length ? ` | effects: ${l.effects.map((e) => e.name).join(', ')}` : ''
    const text = l.text ? ` text="${l.text.slice(0, 40)}"` : ''
    const expr = l.expressions && Object.keys(l.expressions).length ? ` | expr: ${Object.keys(l.expressions).join(', ')}` : ''
    const masks = l.masks && l.masks.length ? ` | masks: ${l.masks.length}` : ''
    lines.push(
      `  [${l.index}] ${l.name} (${l.type}) in:${l.inPoint}s out:${l.outPoint}s${text}${animStr}${fx}${expr}${masks}`
    )
  }
  if (comp.markers.length) {
    lines.push(`  markers: ${comp.markers.map((m) => `${m.time}s:${m.label}`).join(', ')}`)
  }
  if (comp.renderQueue.length) {
    lines.push(`  render queue: ${comp.renderQueue.length} item(s), statuses: ${comp.renderQueue.map((r) => r.status).join(', ')}`)
  }
  if (comp.workArea) lines.push(`  work area: ${comp.workArea.start}s-${comp.workArea.end}s`)
  return lines.join('\n')
}

export function formatQC(report: QCReport): string {
  const head = report.passed ? 'QUALITY CHECK: PASS' : 'QUALITY CHECK: FAIL'
  const items = report.checks
    .map((c) => `  [${c.severity.toUpperCase()}] ${c.passed ? 'OK ' : 'XX '}${c.name}: ${c.message}`)
    .join('\n')
  return `${head}\n${items}`
}
