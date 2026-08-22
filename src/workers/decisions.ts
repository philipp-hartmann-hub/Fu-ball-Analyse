/// <reference lib="webworker" />
import { buildDecisionRadar } from '../lib/decisions'
import type { MatchScore } from '../lib/table'
import type { Match, StandingRow } from '../types'
import type { LeagueZoneId } from '../lib/table'

export type DecisionsWorkerInput = {
  league: LeagueZoneId
  confirmedStandings: StandingRow[]
  liveStandings: StandingRow[]
  remainingConfirmed: Match[]
  remainingLive: Match[]
  hasLive: boolean
  includeTriggers?: boolean
  nowMs?: number
  priorScores?: MatchScore[]
}

export type DecisionsWorkerRequest = {
  id: number
  input: DecisionsWorkerInput
}

export type DecisionsWorkerResponse =
  | { id: number; ok: true; result: ReturnType<typeof buildDecisionRadar> }
  | { id: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<DecisionsWorkerRequest>) => {
  const { id, input } = event.data
  try {
    const result = buildDecisionRadar(input)
    const response: DecisionsWorkerResponse = { id, ok: true, result }
    self.postMessage(response)
  } catch (err) {
    const response: DecisionsWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : 'Entscheidungs-Radar fehlgeschlagen',
    }
    self.postMessage(response)
  }
}
