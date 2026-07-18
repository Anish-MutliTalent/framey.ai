// Headless smoke test — exercises the real engine (executeTool → runtime →
// simulated AE driver → action log → quality checks → deterministic replay)
// WITHOUT an LLM or a Fireworks key. It drives the same tool path the agent
// loop uses, so it verifies everything except the model itself.
//
//   npx tsx scripts/smoke.ts

import { unlinkSync } from 'node:fs'
import { AgentRuntime } from '../src/main/agent/runtime'
import { executeTool, type ToolContext } from '../src/main/agent/tools'
import { SimulatedAEDriver } from '../src/main/bridge/simulatedDriver'
import { readActionLog, replayLog } from '../src/main/agent/actionLog'
import type { AgentEvent, CompState, FrameySettings, QCReport } from '../src/shared/protocol'

async function main(): Promise<void> {
  try {
    unlinkSync('framey-action-log.jsonl')
  } catch {
    /* ok */
  }

  const settings: FrameySettings = {
    llm: 'fireworks',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    apiKey: '', // no key — we exercise the engine, not the LLM
    model: 'accounts/fireworks/models/minimax-m3',
    aeDriver: 'simulate',
    bridgePort: 49321
  }

  const state: { comp: CompState | null; qc: QCReport | null; errors: string[] } = {
    comp: null,
    qc: null,
    errors: []
  }

  const runtime = new AgentRuntime(settings, (ev: AgentEvent) => {
    if (ev.type === 'comp-update') state.comp = ev.comp
    else if (ev.type === 'qc') state.qc = ev.report
    else if (ev.type === 'error') state.errors.push(ev.message)
  })
  await runtime.init()

  const ctx: ToolContext = {
    agent: 'orchestrator',
    runtime: {
      runCommand: (a, c) => runtime.runCommand(a, c),
      runQualityCheck: (id) => runtime.runQualityCheck(id),
      delegate: async () => 'delegation not used in smoke test'
    }
  }

  console.log('--- building a 10s launch comp via the real tool path ---')
  const c = await executeTool('create_composition', { name: 'Smoke — Launch', preset: 'landscape_1080p', durationSeconds: 10 }, ctx)
  if (!c.ok) throw new Error('create_composition failed: ' + c.summary)
  const compId = (c.data as { compId?: string } | undefined)?.compId ?? ''
  if (!compId) throw new Error('no compId returned')
  console.log('compId:', compId)

  // continuous, component-by-component flow: add → set duration → animate
  await executeTool('add_solid_layer', { compId, name: 'BG', color: [0.03, 0.03, 0.05] }, ctx)
  await executeTool('set_layer_timing', { compId, layerName: 'BG', inPoint: 0, outPoint: 10 }, ctx)
  await executeTool(
    'animate_property',
    { compId, layerName: 'BG', propertyPath: 'Transform.Scale', keyframes: [{ time: 0, value: [100, 100] }, { time: 10, value: [108, 108] }] },
    ctx
  )

  await executeTool(
    'add_text_layer',
    { compId, name: 'Title', text: 'Acme', fontSize: 180, fillColor: [1, 1, 1], position: [960, 540], anchorPoint: [960, 540] },
    ctx
  )
  await executeTool('set_layer_timing', { compId, layerName: 'Title', inPoint: 0.3, outPoint: 10 }, ctx)
  await executeTool(
    'animate_property',
    { compId, layerName: 'Title', propertyPath: 'Transform.Scale', keyframes: [{ time: 0.3, value: [0, 0] }, { time: 1.0, value: [112, 112] }, { time: 1.25, value: [100, 100] }] },
    ctx
  )
  await executeTool(
    'animate_property',
    { compId, layerName: 'Title', propertyPath: 'Transform.Opacity', keyframes: [{ time: 0.3, value: 0 }, { time: 0.9, value: 100 }] },
    ctx
  )

  await executeTool('add_marker', { compId, time: 0, label: 'Intro', markerType: 'chapter' }, ctx)
  await executeTool('add_marker', { compId, time: 2, label: 'Title reveal', markerType: 'chapter' }, ctx)
  await executeTool('set_work_area', { compId, start: 0, end: 10 }, ctx)

  // checkpoint / revert safety net
  const cp = await executeTool('checkpoint', { label: 'before-CTA' }, ctx)
  if (!cp.ok) throw new Error('checkpoint failed: ' + cp.summary)
  await executeTool('add_text_layer', { compId, name: 'TempLayer', text: 'temp', position: [100, 100] }, ctx)
  const beforeRevert = state.comp?.layers.length ?? 0
  await executeTool('revert_checkpoint', { label: 'before-CTA' }, ctx)
  const afterRevert = state.comp?.layers.length ?? 0
  if (afterRevert >= beforeRevert) throw new Error('revert_checkpoint did not restore state')

  await executeTool('save_project', { path: 'C:/Framey/Smoke_launch.aep' }, ctx)
  await executeTool('add_to_render_queue', { compId, outputModule: 'H.264', outputPath: 'C:/Framey/Smoke_launch.mp4' }, ctx)

  const q = await executeTool('run_quality_check', { compId }, ctx)
  state.qc = q.data as QCReport

  await executeTool('render', {}, ctx)

  const log = readActionLog('framey-action-log.jsonl')
  const comp = state.comp
  console.log('\n--- smoke results ---')
  console.log('action log entries:', log.length)
  if (comp) {
    console.log(
      `comp: "${comp.name}" ${comp.width}x${comp.height} @ ${comp.frameRate}fps, ${comp.durationSeconds}s, ${comp.layers.length} layers, ${comp.markers.length} markers, saved=${!!comp.savedPath}`
    )
  }
  if (state.qc) console.log(`QC: passed=${state.qc.passed}, ${state.qc.checks.filter((x) => !x.passed).length} issues`)
  console.log('errors:', state.errors.length)

  // deterministic replay against a fresh simulator
  const fresh = new SimulatedAEDriver({})
  await fresh.init()
  const replay = await replayLog(fresh, log)
  console.log(`replay: ok=${replay.ok} failed=${replay.failed}`)
  // run_extendscript must be rejected in simulator mode (checked directly so it
  // doesn't pollute the action log / replay)
  const esRes = await fresh.execute({ type: 'run_extendscript', code: 'app.project' })
  if (esRes.ok) throw new Error('run_extendscript should fail in simulator mode')
  await fresh.dispose()
  await runtime.dispose()

  const failures: string[] = []
  if (state.errors.length) failures.push(`${state.errors.length} error(s): ${state.errors.join('; ')}`)
  if (!comp || comp.width !== 1920 || comp.height !== 1080) failures.push('comp is not 1920x1080 (preset broken)')
  if (!comp || comp.layers.length < 2) failures.push('too few layers')
  if (!comp || !comp.savedPath) failures.push('project not saved')
  if (!state.qc || !state.qc.passed) failures.push('QC did not pass')
  if (log.length < 12) failures.push(`only ${log.length} log entries`)
  if (replay.failed > 0) failures.push(`replay had ${replay.failed} failures`)

  if (failures.length > 0) {
    console.error('\nSMOKE FAIL ✗\n  ' + failures.join('\n  '))
    process.exit(1)
  }
  console.log('\nSMOKE PASS ✓')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
