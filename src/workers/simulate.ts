/// <reference lib="webworker" />
import {
  runSeasonSimulation,
  type SeasonSimulationInput,
  type SeasonSimulationResult,
} from '../lib/simulation'

export type SimulateWorkerRequest = {
  id: number
  input: SeasonSimulationInput
}

export type SimulateWorkerResponse =
  | { id: number; ok: true; result: SeasonSimulationResult }
  | { id: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<SimulateWorkerRequest>) => {
  const { id, input } = event.data
  try {
    const result = runSeasonSimulation(input)
    const response: SimulateWorkerResponse = { id, ok: true, result }
    self.postMessage(response)
  } catch (err) {
    const response: SimulateWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : 'Simulation fehlgeschlagen',
    }
    self.postMessage(response)
  }
}
