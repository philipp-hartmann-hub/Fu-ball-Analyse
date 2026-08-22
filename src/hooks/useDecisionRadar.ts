import { useEffect, useMemo, useRef, useState } from 'react'
import { buildDecisionRadar, type DecisionRadar } from '../lib/decisions'
import type { Match, StandingRow } from '../types'
import type { LeagueZoneId, MatchScore } from '../lib/table'
import type {
  DecisionsWorkerInput,
  DecisionsWorkerRequest,
  DecisionsWorkerResponse,
} from '../workers/decisions'

function standingsFingerprint(standings: StandingRow[]): string {
  return standings
    .map((s) =>
      [s.teamId, s.rank, s.points, s.played, s.won, s.draw, s.lost].join(':'),
    )
    .join('|')
}

function matchIds(matches: Match[]): string {
  return matches.map((m) => m.matchID).join(',')
}

function fingerprintInput(input: {
  league: LeagueZoneId
  dataVersion: string
  hasLive: boolean
  includeLiveInTable: boolean
  confirmedStandings: StandingRow[]
  liveStandings: StandingRow[]
  remainingConfirmed: Match[]
  remainingLive: Match[]
  playedScores: MatchScore[]
}): string {
  return JSON.stringify({
    league: input.league,
    dataVersion: input.dataVersion,
    hasLive: input.hasLive,
    includeLiveInTable: input.includeLiveInTable,
    confirmed: standingsFingerprint(input.confirmedStandings),
    live: standingsFingerprint(input.liveStandings),
    remConf: matchIds(input.remainingConfirmed),
    remLive: matchIds(input.remainingLive),
    played: input.playedScores.map((s) =>
      [s.matchId, s.homeGoals, s.awayGoals].join(':'),
    ),
  })
}

interface Args {
  enabled: boolean
  league: LeagueZoneId
  dataVersion: string
  confirmedStandings: StandingRow[]
  liveStandings: StandingRow[]
  remainingConfirmed: Match[]
  remainingLive: Match[]
  hasLive: boolean
  includeLiveInTable: boolean
  playedScores: MatchScore[]
}

export function useDecisionRadar({
  enabled,
  league,
  dataVersion,
  confirmedStandings,
  liveStandings,
  remainingConfirmed,
  remainingLive,
  hasLive,
  includeLiveInTable,
  playedScores,
}: Args) {
  const [radar, setRadar] = useState<DecisionRadar | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  const fingerprint = useMemo(
    () =>
      fingerprintInput({
        league,
        dataVersion,
        hasLive,
        includeLiveInTable,
        confirmedStandings,
        liveStandings,
        remainingConfirmed,
        remainingLive,
        playedScores,
      }),
    [
      league,
      dataVersion,
      hasLive,
      includeLiveInTable,
      confirmedStandings,
      liveStandings,
      remainingConfirmed,
      remainingLive,
      playedScores,
    ],
  )

  const latest = useRef({
    league,
    confirmedStandings,
    liveStandings,
    remainingConfirmed,
    remainingLive,
    hasLive,
    playedScores,
  })
  latest.current = {
    league,
    confirmedStandings,
    liveStandings,
    remainingConfirmed,
    remainingLive,
    hasLive,
    playedScores,
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setError(null)
      return
    }

    if (confirmedStandings.length === 0) {
      setRadar(null)
      setLoading(false)
      return
    }

    const id = ++reqId.current
    setLoading(true)
    setError(null)

    const {
      league: lg,
      confirmedStandings: confirmed,
      liveStandings: liveRows,
      remainingConfirmed: remConf,
      remainingLive: remLive,
      hasLive: isLive,
      playedScores: prior,
    } = latest.current

    const input: DecisionsWorkerInput = {
      league: lg,
      confirmedStandings: confirmed,
      liveStandings: liveRows,
      remainingConfirmed: remConf,
      remainingLive: remLive,
      hasLive: isLive,
      includeTriggers: true,
      priorScores: prior,
    }

    const applySync = () => {
      try {
        const result = buildDecisionRadar(input)
        if (reqId.current === id) {
          setRadar(result)
          setLoading(false)
          setError(null)
        }
      } catch (err) {
        if (reqId.current === id) {
          setError(
            err instanceof Error ? err.message : 'Entscheidungs-Radar fehlgeschlagen',
          )
          setLoading(false)
        }
      }
    }

    let worker: Worker
    try {
      worker = new Worker(new URL('../workers/decisions.ts', import.meta.url), {
        type: 'module',
      })
    } catch {
      applySync()
      return
    }

    const onMessage = (event: MessageEvent<DecisionsWorkerResponse>) => {
      if (event.data.id !== id) return
      if (event.data.ok) {
        setRadar(event.data.result)
        setError(null)
      } else {
        setError(event.data.error)
      }
      setLoading(false)
      worker.terminate()
    }

    const onError = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate()
      applySync()
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    const payload: DecisionsWorkerRequest = { id, input }
    worker.postMessage(payload)

    return () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate()
    }
  }, [enabled, fingerprint, confirmedStandings.length])

  return { radar, loading, error }
}
