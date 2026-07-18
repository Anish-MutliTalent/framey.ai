// IPC between the renderer (React UI) and the main process (agent runtime).
//
// Renderer -> main:  framey:send, framey:get-settings, framey:update-settings,
//                    framey:get-connection, framey:get-action-log
// Main -> renderer:  framey:event  (the AgentEvent stream — chat text, tool
//                    calls, actions, comp updates, quality checks, status)

import { ipcMain, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { FrameySettings } from '../shared/protocol'
import { AgentRuntime } from './agent/runtime'
import { readActionLog } from './agent/actionLog'

const SETTINGS_FILE = 'framey-settings.json'
const ACTION_LOG_FILE = 'framey-action-log.jsonl'

export function loadSettings(): FrameySettings {
  const env = process.env
  const defaults: FrameySettings = {
    llm: 'fireworks',
    baseURL: env['FRAMEY_BASE_URL'] ?? 'https://api.fireworks.ai/inference/v1',
    apiKey: env['FRAMEY_API_KEY'] ?? '',
    model: env['FRAMEY_MODEL'] ?? 'accounts/fireworks/models/minimax-m3',
    aeDriver: (env['FRAMEY_AE_DRIVER'] as 'simulate' | 'extendscript') ?? 'simulate',
    bridgePort: Number(env['FRAMEY_BRIDGE_PORT'] ?? 49321)
  }
  try {
    if (existsSync(SETTINGS_FILE)) {
      const file = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as Partial<FrameySettings>
      const merged = { ...defaults, ...file }
      // migrate the old, wrong base URL (404s) to the correct Fireworks endpoint
      if (merged.baseURL === 'https://api.fireworks.ai/v1') {
        merged.baseURL = 'https://api.fireworks.ai/inference/v1'
      }
      return merged
    }
  } catch {
    /* ignore malformed settings file */
  }
  return defaults
}

function saveSettings(s: FrameySettings): void {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8')
  } catch {
    /* ignore */
  }
}

export function registerIPC(runtime: AgentRuntime, getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('framey:get-settings', () => runtime.getSettings())
  ipcMain.handle('framey:get-connection', () => runtime.getConnection())

  ipcMain.handle('framey:update-settings', async (_e, s: FrameySettings) => {
    saveSettings(s)
    await runtime.applySettings(s)
    return runtime.getConnection()
  })

  ipcMain.handle('framey:send', async (_e, text: string) => {
    void runtime.run(text) // events stream back over framey:event
    return true
  })

  ipcMain.handle('framey:get-action-log', () => {
    try {
      return readActionLog(ACTION_LOG_FILE)
    } catch {
      return []
    }
  })
}
