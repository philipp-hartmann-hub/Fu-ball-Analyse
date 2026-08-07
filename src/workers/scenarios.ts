/// <reference lib="webworker" />
import {
  computeNextMatchdayOutlook,
  computeTargetMatchdayOutlook,
} from '../lib/scenarios'
import type { MatchScore } from '../lib/table'
import type {
  Match,
  NextMatchdayOutlook,
  StandingRow,
  TargetComparator,
  TargetOutlook,
} from '../types'

export type ScenariosWorkerRequest =
  | {
      id: number
      kind: 'matchday'
      baseStandings: StandingRow[]
      remaining: Match[]
      teamId: number
      priorScores: MatchScore[]
    }
  | {
      id: number
      kind: 'target'
      baseStandings: StandingRow[]
      remaining: Match[]
      teamId: number
      target: number
      comparator: TargetComparator
      priorScores: MatchScore[]
    }

export type ScenariosWorkerResponse =
  | {
      id: number
      ok: true
      kind: 'matchday'
      result: NextMatchdayOutlook | null
    }
  | {
      id: number
      ok: true
      kind: 'target'
      result: TargetOutlook | null
    }
  | { id: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<ScenariosWorkerRequest>) => {
  const msg = event.data
  try {
    if (msg.kind === 'matchday') {
      const result = computeNextMatchdayOutlook(
        msg.baseStandings,
        msg.remaining,
        msg.teamId,
        msg.priorScores,
      )
      const response: ScenariosWorkerResponse = {
        id: msg.id,
        ok: true,
        kind: 'matchday',
        result,
      }
      self.postMessage(response)
      return
    }
    const result = computeTargetMatchdayOutlook(
      msg.baseStandings,
      msg.remaining,
      msg.teamId,
      msg.target,
      msg.comparator,
      msg.priorScores,
    )
    const response: ScenariosWorkerResponse = {
      id: msg.id,
      ok: true,
      kind: 'target',
      result,
    }
    self.postMessage(response)
  } catch (err) {
    const response: ScenariosWorkerResponse = {
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : 'Spieltag-Analyse fehlgeschlagen',
    }
    self.postMessage(response)
  }
}
