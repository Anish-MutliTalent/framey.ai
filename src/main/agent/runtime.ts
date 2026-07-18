// AgentRuntime — the heart of Framey.
//
// Owns the AE driver, the LLM client, the action log, and the event stream to
// the renderer. Runs a tool-calling agent loop against Fireworks (MiniMax),
// with specialist delegation for the craft phases. A Fireworks API key is
// required; with none, run() emits a clear error instead of executing.

import { createAEDriver, type AEDriver } from '../bridge/aeDriver'
import { createLLMClient, type LLMClient, type LLMMessage } from './llm'
import { AGENT_TOOLS, SPECIALIST_TOOLS, executeTool, type ToolContext } from './tools'
import { specialistPrompt, orchestratorSystemPrompt } from './prompts'
import { ActionLog } from './actionLog'
import { runQualityCheck } from './quality'
import type {
  AECommand,
  AEResult,
  AgentEvent,
  CompState,
  ConnectionStatus,
  FrameySettings,
  QCReport
} from '../../shared/protocol'

const ACTION_LOG_PATH = 'framey-action-log.jsonl'

export interface AgentLoopOpts {
  agent: string
  system: string
  userTask: string
  tools: typeof AGENT_TOOLS
  maxIterations: number
  announceText: boolean
}

export class AgentRuntime {
  private settings: FrameySettings
  private emit: (ev: AgentEvent) => void
  private driver: AEDriver
  private llm: LLMClient | null
  private log: ActionLog
  private running = false
  private delegateDepth = 0
  private lastAeStatus: ConnectionStatus['ae'] = 'disconnected'

  constructor(settings: FrameySettings, emit: (ev: AgentEvent) => void) {
    this.settings = settings
    this.emit = emit
    this.log = new ActionLog(ACTION_LOG_PATH)
    this.driver = createAEDriver(settings, this.driverCallbacks())
    this.llm = createLLMClient(settings)
  }

  private driverCallbacks() {
    return {
      onCompUpdate: (comp: CompState | null) => {
        this.emit({ type: 'comp-update', comp })
      },
      onConnection: (s: ConnectionStatus['ae']) => {
        this.lastAeStatus = s
        this.emit({ type: 'connection', connection: this.getConnection() })
      }
    }
  }

  async init(): Promise<void> {
    try {
      await this.driver.init()
    } catch (e) {
      this.emit({ type: 'error', message: `AE driver init failed: ${(e as Error).message}` })
    }
    this.emit({ type: 'connection', connection: this.getConnection() })
  }

  getSettings(): FrameySettings {
    return this.settings
  }

  getConnection(): ConnectionStatus {
    return {
      ae: this.lastAeStatus,
      model: this.settings.model,
      llm: 'fireworks'
    }
  }

  async applySettings(s: FrameySettings): Promise<void> {
    this.settings = s
    await this.driver.dispose().catch(() => {})
    this.driver = createAEDriver(s, this.driverCallbacks())
    this.llm = createLLMClient(s)
    await this.driver.init().catch((e) => {
      this.emit({ type: 'error', message: `AE driver init failed: ${(e as Error).message}` })
    })
    this.emit({ type: 'connection', connection: this.getConnection() })
  }

  // ── command execution (logged + replayable) ───────────────────────────────
  async runCommand(agent: string, cmd: AECommand): Promise<AEResult> {
    const result = await this.driver.execute(cmd)
    const entry = this.log.log(agent, cmd, result)
    this.emit({ type: 'action', entry })
    return result
  }

  async runQualityCheck(_compId?: string): Promise<QCReport> {
    const comp = this.driver.getCompState()
    const report = runQualityCheck(comp)
    this.emit({ type: 'qc', report })
    return report
  }

  // ── specialist delegation ─────────────────────────────────────────────────
  async delegate(specialist: string, task: string): Promise<string> {
    if (this.delegateDepth >= 2) {
      return 'delegation depth limit reached; finishing inline.'
    }
    if (!this.llm) {
      throw new Error('LLM not configured')
    }
    this.delegateDepth++
    this.emit({
      type: 'phase',
      phase: {
        name: specialist,
        specialist: specialist as 'cuts' | 'motion' | 'sound' | 'qc',
        detail: task.slice(0, 80),
        status: 'running'
      }
    })
    try {
      const summary = await this.runAgentLoop({
        agent: specialist,
        system: specialistPrompt(specialist),
        userTask: task,
        tools: SPECIALIST_TOOLS,
        maxIterations: 8,
        announceText: false
      })
      this.emit({
        type: 'phase',
        phase: {
          name: specialist,
          specialist: specialist as 'cuts' | 'motion' | 'sound' | 'qc',
          detail: summary.slice(0, 80),
          status: 'done'
        }
      })
      return summary
    } finally {
      this.delegateDepth--
    }
  }

  // ── public entry: run a user request ──────────────────────────────────────
  async run(userText: string): Promise<void> {
    if (this.running) {
      this.emit({ type: 'error', message: 'Framey is already working on a request.' })
      return
    }
    this.running = true
    this.log.reset()
    this.emit({ type: 'status', status: 'planning' })
    this.emit({
      type: 'phase',
      phase: { name: 'plan', specialist: 'orchestrator', detail: userText.slice(0, 80), status: 'running' }
    })
    try {
      if (!this.llm) {
        this.emit({
          type: 'error',
          message:
            'No Fireworks API key configured. Open Settings and add your Fireworks API key — Framey drives After Effects using a real MiniMax model on Fireworks.'
        })
        this.emit({ type: 'status', status: 'error' })
        return
      }
      this.emit({ type: 'status', status: 'executing' })
      const summary = await this.runAgentLoop({
        agent: 'orchestrator',
        system: orchestratorSystemPrompt(this.settings.aeDriver),
        userTask: userText,
        tools: AGENT_TOOLS,
        maxIterations: 24,
        announceText: true
      })
      this.emit({ type: 'status', status: 'done' })
      this.emit({ type: 'done', summary })
    } catch (e) {
      this.emit({ type: 'error', message: `agent error: ${(e as Error).message}` })
      this.emit({ type: 'status', status: 'error' })
    } finally {
      this.running = false
    }
  }

  // ── the tool-calling loop (Fireworks / MiniMax) ───────────────────────────
  private async runAgentLoop(opts: AgentLoopOpts): Promise<string> {
    if (!this.llm) throw new Error('LLM not configured')
    const llm = this.llm
    const messages: LLMMessage[] = [{ role: 'user', content: opts.userTask }]
    const ctx: ToolContext = {
      agent: opts.agent,
      runtime: {
        runCommand: (a: string, c: AECommand) => this.runCommand(a, c),
        runQualityCheck: (id?: string) => this.runQualityCheck(id),
        delegate: (s: string, t: string) => this.delegate(s, t)
      }
    }
    let lastText = ''

    for (let i = 0; i < opts.maxIterations; i++) {
      const resp = await llm.chat({
        system: opts.system,
        messages,
        tools: opts.tools,
        model: this.settings.model
      })
      if (resp.text && opts.announceText) {
        this.emit({ type: 'assistant-text', text: resp.text })
      }
      lastText = resp.text || lastText

      if (!resp.toolCalls.length) {
        return lastText || 'done'
      }

      messages.push({ role: 'assistant', content: resp.text, tool_calls: resp.toolCalls })

      for (const tc of resp.toolCalls) {
        const name = tc.function.name
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        } catch {
          args = {}
        }
        this.emit({ type: 'tool-call', agent: opts.agent, tool: name, args, callId: tc.id })
        const res = await executeTool(name, args, ctx)
        this.emit({ type: 'tool-result', callId: tc.id, ok: res.ok, summary: res.summary, data: res.data })
        messages.push({ role: 'tool', tool_call_id: tc.id, name, content: res.summary })
      }
    }
    return lastText || 'reached iteration limit'
  }

  async dispose(): Promise<void> {
    await this.driver.dispose().catch(() => {})
  }
}
