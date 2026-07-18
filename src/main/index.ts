// Framey AI — Electron main entry.
// Creates the window, loads settings (env + framey-settings.json), boots the
// agent runtime, and wires IPC. The renderer never touches the Fireworks API
// key or the AE driver directly — everything flows through main.

import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { AgentRuntime } from './agent/runtime'
import { loadSettings, registerIPC } from './ipc'

let mainWindow: BrowserWindow | null = null
let runtime: AgentRuntime | null = null

// Minimal .env loader (no dotenv dependency). Only sets vars not already
// present in the environment, so real env vars win.
function loadEnvFile(): void {
  try {
    if (!existsSync('.env')) return
    const text = readFileSync('.env', 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      if (process.env[key] === undefined) {
        process.env[key] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    /* ignore */
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b0b12',
    title: 'Framey AI',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  loadEnvFile()
  const settings = loadSettings()

  runtime = new AgentRuntime(settings, (ev) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('framey:event', ev)
    }
  })
  registerIPC(runtime, () => mainWindow)
  await runtime.init()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  await runtime?.dispose().catch(() => {})
})
