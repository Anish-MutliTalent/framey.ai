// Zustand store — the renderer's single source of truth, fed by the AgentEvent
// stream from main. Holds chat messages, the live activity feed, the comp
// preview, quality report, phases, status, and connection.

import { create } from 'zustand'
import { framey } from '../ipc'
import type {
  ActionLogEntry,
  AgentEvent,
  AgentPhase,
  AppStatus,
  ChatMessage,
  CompState,
  ConnectionStatus,
  FrameySettings,
  QCReport
} from '../../../shared/protocol'

export type FeedItem =
  | { id: string; kind: 'tool-call'; agent: string; tool: string; args: Record<string, unknown>; ts: number }
  | { id: string; kind: 'tool-result'; ok: boolean; summary: string; ts: number }
  | { id: string; kind: 'action'; entry: ActionLogEntry; ts: number }

interface State {
  messages: ChatMessage[]
  feed: FeedItem[]
  phases: Record<string, AgentPhase>
  comp: CompState | null
  qc: QCReport | null
  status: AppStatus
  connection: ConnectionStatus | null
  settings: FrameySettings | null
  input: string
  busy: boolean

  init: () => Promise<void>
  send: (textOverride?: string) => Promise<void>
  setInput: (s: string) => void
  updateSettings: (s: FrameySettings) => Promise<void>
  handleEvent: (ev: AgentEvent) => void
}

let counter = 0
const nid = () => `f${++counter}`
const now = () => Date.now()

export const useStore = create<State>((set, get) => ({
  messages: [],
  feed: [],
  phases: {},
  comp: null,
  qc: null,
  status: 'idle',
  connection: null,
  settings: null,
  input: '',
  busy: false,

  setInput: (s) => set({ input: s }),

  init: async () => {
    const [settings, connection] = await Promise.all([framey.getSettings(), framey.getConnection()])
    set({ settings, connection })
    framey.onEvent((ev) => get().handleEvent(ev))
  },

  send: async (textOverride) => {
    const text = (textOverride ?? get().input).trim()
    if (!text || get().busy) return
    set((s) => ({
      input: '',
      busy: true,
      status: 'planning',
      feed: [],
      phases: {},
      qc: null,
      messages: [...s.messages, { id: nid(), role: 'user', text, ts: now() }]
    }))
    await framey.send(text)
  },

  updateSettings: async (s) => {
    const connection = await framey.updateSettings(s)
    set({ settings: s, connection })
  },

  handleEvent: (ev) => {
    switch (ev.type) {
      case 'assistant-text':
        set((s) => ({
          messages: [...s.messages, { id: nid(), role: 'assistant', text: ev.text, ts: now() }]
        }))
        break
      case 'tool-call':
        set((s) => ({
          feed: [...s.feed, { id: nid(), kind: 'tool-call', agent: ev.agent, tool: ev.tool, args: ev.args, ts: now() }]
        }))
        break
      case 'tool-result':
        set((s) => ({
          feed: [...s.feed, { id: nid(), kind: 'tool-result', ok: ev.ok, summary: ev.summary, ts: now() }]
        }))
        break
      case 'action':
        set((s) => ({ feed: [...s.feed, { id: nid(), kind: 'action', entry: ev.entry, ts: ev.entry.ts }] }))
        break
      case 'comp-update':
        set({ comp: ev.comp })
        break
      case 'qc':
        set({ qc: ev.report })
        break
      case 'phase':
        set((s) => ({ phases: { ...s.phases, [ev.phase.name]: ev.phase } }))
        break
      case 'status':
        set({ status: ev.status, busy: ev.status !== 'done' && ev.status !== 'error' && ev.status !== 'idle' })
        break
      case 'connection':
        set({ connection: ev.connection })
        break
      case 'error':
        set((s) => ({
          messages: [...s.messages, { id: nid(), role: 'system', text: ev.message, ts: now() }],
          busy: false
        }))
        break
      case 'done':
        set({ busy: false, status: 'done' })
        break
    }
  }
}))
