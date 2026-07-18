// AE driver abstraction. Two implementations share this interface:
//   - SimulatedAEDriver   : in-process comp model (no After Effects needed)
//   - ExtendScriptAEDriver: drives a real running AE over a TCP bridge
//
// The agent runtime only ever talks to AEDriver, so the whole pipeline is
// mode-agnostic. Switching from a demo on any laptop to real AE is one env var.

import type {
  AECommand,
  AEResult,
  CompState,
  ConnectionStatus,
  FrameySettings
} from '../../shared/protocol'
import { SimulatedAEDriver } from './simulatedDriver'
import { ExtendScriptAEDriver } from './extendscriptDriver'

export interface AEDriverCallbacks {
  onCompUpdate?: (comp: CompState | null) => void
  onConnection?: (status: ConnectionStatus['ae']) => void
}

export interface AEDriver {
  readonly mode: 'simulate' | 'extendscript'
  init(): Promise<void>
  execute(cmd: AECommand): Promise<AEResult>
  getCompState(): CompState | null
  setCallbacks(cb: AEDriverCallbacks): void
  dispose(): Promise<void>
}

export function createAEDriver(settings: FrameySettings, cb: AEDriverCallbacks): AEDriver {
  if (settings.aeDriver === 'extendscript') {
    return new ExtendScriptAEDriver(settings, cb)
  }
  return new SimulatedAEDriver(cb)
}
