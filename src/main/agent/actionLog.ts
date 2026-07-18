// Deterministic action log — every AE command the agents issue is appended to
// a JSONL file with sequence, timestamp, agent, command, and result summary.
// A result is never a lucky one-off: the log can be re-run against a fresh
// driver (simulate or real AE) and reproduce the same project.

import { appendFileSync, readFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { ActionLogEntry, AECommand, AEResult } from '../../shared/protocol'
import type { AEDriver } from '../bridge/aeDriver'

export class ActionLog {
  private path: string
  private seq = 0

  constructor(path: string) {
    this.path = path
  }

  log(agent: string, cmd: AECommand, result: AEResult): ActionLogEntry {
    this.seq++
    const entry: ActionLogEntry = {
      id: randomUUID(),
      seq: this.seq,
      ts: Date.now(),
      agent,
      command: cmd.type,
      args: cmd as unknown as Record<string, unknown>,
      ok: result.ok,
      resultSummary: result.summary
    }
    try {
      appendFileSync(this.path, JSON.stringify(entry) + '\n', 'utf8')
    } catch {
      /* logging must never break the build */
    }
    return entry
  }

  reset(): void {
    this.seq = 0
  }
}

export function readActionLog(path: string): ActionLogEntry[] {
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  return text
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as ActionLogEntry)
}

export interface ReplayResult {
  ok: number
  failed: number
  details: string[]
}

// Re-run a captured action log against a fresh driver. Skips read-only
// get_comp_state commands. Returns a per-command tally.
export async function replayLog(driver: AEDriver, entries: ActionLogEntry[]): Promise<ReplayResult> {
  let ok = 0
  let failed = 0
  const details: string[] = []
  for (const e of entries) {
    if (e.command === 'get_comp_state') continue
    const cmd = e.args as unknown as AECommand
    const res = await driver.execute(cmd)
    if (res.ok) {
      ok++
    } else {
      failed++
      details.push(`#${e.seq} ${e.command}: ${res.error ?? res.summary}`)
    }
  }
  return { ok, failed, details }
}
