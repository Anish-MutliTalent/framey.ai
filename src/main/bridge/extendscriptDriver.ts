// ExtendScriptAEDriver — drives a real, running Adobe After Effects over the
// TCP bridge. The ae/driver.jsx script (loaded into AE) connects to this
// server, receives AECommand objects, executes them through AE's scripting
// DOM, and returns AEResult objects. It also pushes the full CompState after
// every mutation so the renderer's timeline preview stays live.

import { randomUUID } from 'node:crypto'
import type { AECommand, AEResult, CompState, ConnectionStatus, FrameySettings } from '../../shared/protocol'
import type { AEDriver, AEDriverCallbacks } from './aeDriver'
import { BridgeServer, newRequestId } from './server'

function fail(error: string): AEResult {
  return { ok: false, summary: `failed: ${error}`, error }
}

export class ExtendScriptAEDriver implements AEDriver {
  readonly mode = 'extendscript' as const
  private cb: AEDriverCallbacks
  private server: BridgeServer
  private lastComp: CompState | null = null
  private port: number

  constructor(settings: FrameySettings, cb: AEDriverCallbacks) {
    this.cb = cb
    this.port = settings.bridgePort
    this.server = new BridgeServer({
      onComp: (comp) => {
        this.lastComp = comp
        this.cb.onCompUpdate?.(comp)
      },
      onConnection: (s) => {
        this.cb.onConnection?.(s as ConnectionStatus['ae'])
      }
    })
  }

  setCallbacks(cb: AEDriverCallbacks): void {
    this.cb = cb
  }

  async init(): Promise<void> {
    this.cb.onConnection?.('connecting')
    try {
      await this.server.listen(this.port)
    } catch (e) {
      this.cb.onConnection?.('disconnected')
      throw e
    }
  }

  getCompState(): CompState | null {
    return this.lastComp
  }

  async execute(cmd: AECommand): Promise<AEResult> {
    if (!this.server.connected) {
      return fail(
        'After Effects driver is not connected. Open AE and run ae/driver.jsx (File > Scripts > Run Script File…).'
      )
    }
    const req = { id: newRequestId(), cmd }
    try {
      return await this.server.send(req)
    } catch (e) {
      return fail((e as Error).message)
    }
  }

  async dispose(): Promise<void> {
    await this.server.close()
  }
}

// re-export so callers don't need to import randomUUID separately
export { randomUUID }
