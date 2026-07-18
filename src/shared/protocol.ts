// ─────────────────────────────────────────────────────────────────────────
// Framey AI — shared protocol & data model
//
// Pure types + constants only (no Node-only imports) so this file can be
// imported by both the Electron main process and the renderer bundle.
// It is the single contract between:
//   - the agent runtime (LLM tool calls)
//   - the AE drivers (simulated + ExtendScript)
//   - the bridge server
//   - the renderer UI
// ─────────────────────────────────────────────────────────────────────────

export type Color = [number, number, number] // RGB 0..1
export type Vec2 = [number, number]

export interface Easing {
  type: 'linear' | 'bezier' | 'hold'
  influence?: number
  speed?: number
}

export interface Keyframe {
  time: number // seconds
  value: number | Vec2 | number[] | string
  easingIn?: Easing
  easingOut?: Easing
}

export interface Effect {
  name: string
  properties: Record<string, number | string | boolean | number[]>
  enabled: boolean
}

export interface Marker {
  time: number
  label: string
  comment?: string
  type?: 'chapter' | 'web' | 'comment' | 'sound'
}

export interface RenderItem {
  compId: string
  outputModule: string
  outputPath: string
  status: 'queued' | 'rendering' | 'done' | 'failed'
}

export type LayerType = 'solid' | 'text' | 'shape' | 'footage' | 'audio' | 'null'

export interface Layer {
  id: string
  index: number // stacking order, 0 = top
  name: string
  type: LayerType
  enabled: boolean
  inPoint: number // seconds
  outPoint: number // seconds
  // type-specific visuals
  color?: Color // solid / shape fill
  width?: number
  height?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fillColor?: Color // text fill
  position?: Vec2
  anchorPoint?: Vec2
  scale?: Vec2 // percent [100,100]
  rotation?: number // degrees
  opacity?: number // 0..100
  sourcePath?: string
  // animated properties: dotted path -> keyframes (e.g. "Transform.Position")
  animatedProperties: Record<string, Keyframe[]>
  effects: Effect[]
  // escape hatch for arbitrary property paths the agent may set statically
  extraProps?: Record<string, number | Vec2 | number[] | string | boolean>
  // per-property expressions, e.g. "Transform.Position" -> "wiggle(2, 10)"
  expressions?: Record<string, string>
  // mask names on the layer
  masks?: string[]
}

export interface CompState {
  id: string
  name: string
  width: number
  height: number
  frameRate: number
  durationSeconds: number
  bgColor: Color
  layers: Layer[]
  markers: Marker[]
  workArea?: { start: number; end: number }
  renderQueue: RenderItem[]
  savedPath?: string
}

// ── AE commands (discriminated union) ─────────────────────────────────────
// Every command the agent can ask the editor to perform. Each maps 1:1 to an
// ExtendScript operation in the real driver and a state mutation in the
// simulated driver — so a logged action replays identically in either mode.

export interface CmdNewProject { type: 'new_project' }
export interface CmdOpenProject { type: 'open_project'; path: string }
export interface CmdCreateComposition {
  type: 'create_composition'
  name: string
  width: number
  height: number
  frameRate: number
  durationSeconds: number
  bgColor?: Color
}
export interface CmdAddSolidLayer {
  type: 'add_solid_layer'
  compId: string
  name: string
  color: Color
  width?: number
  height?: number
}
export interface CmdAddTextLayer {
  type: 'add_text_layer'
  compId: string
  name: string
  text: string
  fontSize?: number
  fontFamily?: string
  fillColor?: Color
  position?: Vec2
  anchorPoint?: Vec2
}
export interface CmdAddRectangleShape {
  type: 'add_rectangle_shape'
  compId: string
  name: string
  position: Vec2
  size: Vec2
  fillColor?: Color
  strokeColor?: Color
  strokeWidth?: number
}
export interface CmdAddFootageLayer {
  type: 'add_footage_layer'
  compId: string
  filePath: string
  name?: string
}
export interface CmdAddAudioLayer {
  type: 'add_audio_layer'
  compId: string
  filePath: string
  name?: string
  startTime?: number
}
export interface CmdAddNullLayer { type: 'add_null_layer'; compId: string; name: string }
export interface CmdSetProperty {
  type: 'set_property'
  compId: string
  layerName: string
  propertyPath: string
  value: number | Vec2 | number[] | string | boolean
}
export interface CmdSetKeyframes {
  type: 'set_keyframes'
  compId: string
  layerName: string
  propertyPath: string
  keyframes: Keyframe[]
}
export interface CmdSetLayerTiming {
  type: 'set_layer_timing'
  compId: string
  layerName: string
  inPoint: number
  outPoint: number
}
export interface CmdApplyEffect {
  type: 'apply_effect'
  compId: string
  layerName: string
  effectName: string
  properties?: Record<string, number | string | boolean | number[]>
}
export interface CmdAddMarker {
  type: 'add_marker'
  compId: string
  time: number
  label: string
  comment?: string
  markerType?: Marker['type']
}
export interface CmdSetWorkArea {
  type: 'set_work_area'
  compId: string
  start: number
  end: number
}
export interface CmdPrecompose {
  type: 'precompose'
  compId: string
  layerNames: string[]
  name: string
}
export interface CmdSaveProject { type: 'save_project'; path: string }
export interface CmdAddToRenderQueue {
  type: 'add_to_render_queue'
  compId: string
  outputModule?: string
  outputPath?: string
}
export interface CmdRender { type: 'render' }
export interface CmdGetCompState { type: 'get_comp_state'; compId?: string }
export interface CmdRunExtendScript { type: 'run_extendscript'; code: string }
export interface CmdCheckpoint { type: 'checkpoint'; label?: string }
export interface CmdRevertCheckpoint { type: 'revert_checkpoint'; label?: string }

export type AECommand =
  | CmdNewProject
  | CmdOpenProject
  | CmdCreateComposition
  | CmdAddSolidLayer
  | CmdAddTextLayer
  | CmdAddRectangleShape
  | CmdAddFootageLayer
  | CmdAddAudioLayer
  | CmdAddNullLayer
  | CmdSetProperty
  | CmdSetKeyframes
  | CmdSetLayerTiming
  | CmdApplyEffect
  | CmdAddMarker
  | CmdSetWorkArea
  | CmdPrecompose
  | CmdSaveProject
  | CmdAddToRenderQueue
  | CmdRender
  | CmdGetCompState
  | CmdRunExtendScript
  | CmdCheckpoint
  | CmdRevertCheckpoint

export interface AEResult {
  ok: boolean
  data?: unknown
  error?: string
  // human-readable one-liner for the action stream
  summary: string
}

// ── Agent / IPC event stream (main -> renderer) ───────────────────────────

export interface AgentPhase {
  name: string
  specialist: 'orchestrator' | 'cuts' | 'motion' | 'sound' | 'qc'
  detail: string
  status: 'running' | 'done' | 'skipped'
}

export interface ActionLogEntry {
  id: string
  seq: number
  ts: number
  agent: string
  command: string
  args: Record<string, unknown>
  ok: boolean
  resultSummary: string
}

export interface QCCheck {
  name: string
  passed: boolean
  message: string
  severity: 'info' | 'warn' | 'error'
}

export interface QCReport {
  passed: boolean
  checks: QCCheck[]
}

export type AppStatus = 'idle' | 'planning' | 'executing' | 'rendering' | 'done' | 'error'

export type AgentEvent =
  | { type: 'phase'; phase: AgentPhase }
  | { type: 'assistant-text'; text: string }
  | { type: 'tool-call'; agent: string; tool: string; args: Record<string, unknown>; callId: string }
  | { type: 'tool-result'; callId: string; ok: boolean; summary: string; data?: unknown }
  | { type: 'action'; entry: ActionLogEntry }
  | { type: 'comp-update'; comp: CompState | null }
  | { type: 'qc'; report: QCReport }
  | { type: 'status'; status: AppStatus; message?: string }
  | { type: 'connection'; connection: ConnectionStatus }
  | { type: 'error'; message: string }
  | { type: 'done'; summary: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  ts: number
}

// ── Settings & connection ─────────────────────────────────────────────────

export interface FrameySettings {
  llm: 'fireworks'
  baseURL: string
  apiKey: string
  model: string
  aeDriver: 'simulate' | 'extendscript'
  bridgePort: number
}

export interface ConnectionStatus {
  ae: 'simulated' | 'connected' | 'disconnected' | 'connecting'
  model: string
  llm: 'fireworks'
}

// ── Bridge wire protocol (Node bridge <-> ExtendScript socket) ─────────────

export interface BridgeRequest {
  id: string
  cmd: AECommand
}
export interface BridgeResponse {
  id: string
  result: AEResult
}
