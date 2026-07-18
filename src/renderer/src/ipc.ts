// Renderer-side wrapper around the `window.framey` bridge exposed by preload.

import type { AgentEvent, ActionLogEntry, ConnectionStatus, FrameySettings } from '../../shared/protocol'

export interface FrameyAPI {
  send(text: string): Promise<boolean>
  getSettings(): Promise<FrameySettings>
  updateSettings(s: FrameySettings): Promise<ConnectionStatus>
  getConnection(): Promise<ConnectionStatus>
  getActionLog(): Promise<ActionLogEntry[]>
  onEvent(cb: (ev: AgentEvent) => void): () => void
}

declare global {
  interface Window {
    framey: FrameyAPI
  }
}

export const framey: FrameyAPI = (window as unknown as { framey: FrameyAPI }).framey
