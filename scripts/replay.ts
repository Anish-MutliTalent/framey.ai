// Deterministic replay — re-runs the last captured action log against a fresh
// in-process simulator. Proves a build is reproducible, not a lucky one-off.
//
//   npm run replay

import { readActionLog, replayLog } from '../src/main/agent/actionLog'
import { SimulatedAEDriver } from '../src/main/bridge/simulatedDriver'
import type { AEDriverCallbacks } from '../src/main/bridge/aeDriver'

async function main(): Promise<void> {
  const path = 'framey-action-log.jsonl'
  const entries = readActionLog(path)
  if (entries.length === 0) {
    console.log(`No action log found at ${path}. Run Framey once first.`)
    return
  }
  console.log(`Replaying ${entries.length} action(s) against a fresh simulator…\n`)

  const cb: AEDriverCallbacks = {
    onCompUpdate: (comp) => {
      if (comp) {
        const anim = comp.layers.reduce((n, l) => n + Object.keys(l.animatedProperties).length, 0)
        console.log(`  comp "${comp.name}" — ${comp.layers.length} layers, ${anim} animated props, ${comp.markers.length} markers`)
      }
    }
  }
  const driver = new SimulatedAEDriver(cb)
  await driver.init()

  const res = await replayLog(driver, entries)
  console.log(`\nok:   ${res.ok}`)
  console.log(`fail: ${res.failed}`)
  if (res.details.length) {
    console.log('\nfailures:')
    for (const d of res.details) console.log('  ' + d)
  }
  await driver.dispose()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
