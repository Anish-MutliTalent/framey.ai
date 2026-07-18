// Preload — exposes a tiny, safe `framey` API to the renderer via contextBridge.
// The renderer never sees Node, the file system, or the Fireworks API key.

import { contextBridge, ipcRenderer } from 'electron'
import type { AgentEvent, ActionLogEntry, ConnectionStatus, FrameySettings } from '../shared/protocol'

const api = {
  send: (text: string) => ipcRenderer.invoke('framey:send', text),
  getSettings: () => ipcRenderer.invoke('framey:get-settings') as Promise<FrameySettings>,
  updateSettings: (s: FrameySettings) =>
    ipcRenderer.invoke('framey:update-settings', s) as Promise<ConnectionStatus>,
  getConnection: () => ipcRenderer.invoke('framey:get-connection') as Promise<ConnectionStatus>,
  getActionLog: () => ipcRenderer.invoke('framey:get-action-log') as Promise<ActionLogEntry[]>,
  onEvent: (cb: (ev: AgentEvent) => void) => {
    const handler = (_e: unknown, ev: AgentEvent) => cb(ev)
    ipcRenderer.on('framey:event', handler)
    return () => ipcRenderer.removeListener('framey:event', handler)
  }
}

contextBridge.exposeInMainWorld('framey', api)

export type FrameyAPI = typeof api
