// BridgeServer — a tiny newline-delimited JSON TCP server that the
// ExtendScript driver inside After Effects connects to.
//
// Wire protocol (each message is one JSON object per line):
//   Node  -> AE : { "id": "<uuid>", "cmd": <AECommand> }
//   AE    -> Node: { "id": "<uuid>", "result": <AEResult> }      (response)
//                | { "type": "comp", "comp": <CompState> }       (pushed state)
//                | { "type": "hello", "version": "1" }           (on connect)
//
// ExtendScript's Socket object speaks TCP, so this is the lowest-friction
// bridge between a real AE process and the Framey host app.

import { createServer, type Server, type Socket } from 'node:net'
import { randomUUID } from 'node:crypto'
import type { AEResult, BridgeRequest, BridgeResponse, CompState } from '../../shared/protocol'

interface Pending {
  resolve: (r: AEResult) => void
  reject: (e: Error) => void
  timer: NodeJS.Timeout
}

export interface BridgeServerHandlers {
  onComp?: (comp: CompState) => void
  onConnection?: (status: 'connected' | 'disconnected') => void
}

export class BridgeServer {
  private server: Server
  private client: Socket | null = null
  private buffer = ''
  private pending = new Map<string, Pending>()
  private handlers: BridgeServerHandlers

  constructor(handlers: BridgeServerHandlers) {
    this.handlers = handlers
    this.server = createServer((socket) => this.onConnect(socket))
  }

  get connected(): boolean {
    return !!this.client && !this.client.destroyed
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(port, '127.0.0.1', () => {
        this.server.removeListener('error', reject)
        resolve()
      })
    })
  }

  private onConnect(socket: Socket): void {
    // only one AE client at a time
    if (this.client && !this.client.destroyed) {
      socket.destroy()
      return
    }
    this.client = socket
    this.buffer = ''
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      this.buffer += chunk
      let nl = this.buffer.indexOf('\n')
      while (nl >= 0) {
        const line = this.buffer.slice(0, nl).trim()
        this.buffer = this.buffer.slice(nl + 1)
        if (line) this.handleLine(line)
        nl = this.buffer.indexOf('\n')
      }
    })
    socket.on('close', () => this.onDisconnect())
    socket.on('error', () => this.onDisconnect())
    this.handlers.onConnection?.('connected')
  }

  private onDisconnect(): void {
    this.client = null
    this.buffer = ''
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error('After Effects connection closed'))
    }
    this.pending.clear()
    this.handlers.onConnection?.('disconnected')
  }

  private handleLine(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return // ignore malformed lines
    }
    if (msg && msg.id && msg.result) {
      const res = msg as BridgeResponse
      const p = this.pending.get(res.id)
      if (p) {
        clearTimeout(p.timer)
        this.pending.delete(res.id)
        p.resolve(res.result)
      }
    } else if (msg && msg.type === 'comp' && msg.comp) {
      this.handlers.onComp?.(msg.comp as CompState)
    } else if (msg && msg.type === 'hello') {
      // greeting; connection already signaled
    }
  }

  send(req: BridgeRequest): Promise<AEResult> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(
          new Error('After Effects driver is not connected. In AE, choose File > Scripts > Run Script File… and select ae/driver.jsx.')
        )
        return
      }
      const timer = setTimeout(() => {
        this.pending.delete(req.id)
        reject(new Error('AE command timed out after 60s'))
      }, 60000)
      this.pending.set(req.id, {
        resolve,
        reject,
        timer
      })
      this.client!.write(JSON.stringify(req) + '\n')
    })
  }

  async close(): Promise<void> {
    this.client?.destroy()
    this.client = null
    await new Promise<void>((resolve) => this.server.close(() => resolve()))
  }
}

export function newRequestId(): string {
  return randomUUID()
}
