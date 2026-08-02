import { useEffect, useMemo, useRef, useState } from 'react'
import type { Match, ScenarioResult, StandingRow } from '../types'
import {
  DEFAULT_SIMULATIONS,
  runSeasonSimulation,
  type SeasonSimulationResult,
} from '../lib/simulation'
import type { LeagueZoneId, MatchScore } from '../lib/table'
import type {
  SimulateWorkerRequest,
  SimulateWorkerResponse,
} from '../workers/simulate'

interface Args {
  enabled: boolean
  baseStandings: StandingRow[]
  remaining: Match[]
  league: LeagueZoneId
  fixedScenarios: ScenarioResult[]
  playedScores?: MatchScore[]
  runs?: number
}

function fingerprintInput(
  baseStandings: StandingRow[],
  remaining: Match[],
  league: LeagueZoneId,
  fixedScenarios: ScenarioResult[],
  playedScores: MatchScore[],
  runs: number,
): string {
  return JSON.stringify({
    league,
    runs,
    standings: baseStandings.map((s) => [
      s.teamId,
      s.points,
      s.goalDiff,
      s.goalsFor,
      s.goalsAgainst,
      s.played,
    ]),
    remaining: remaining.map((m) => m.matchID),
    fixed: fixedScenarios.map((s) => [s.matchId, s.homeGoals, s.awayGoals]),
    played: playedScores.map((s) => [
      s.matchId,
      s.homeId,
      s.awayId,
      s.homeGoals,
      s.awayGoals,
    ]),
  })
}

function seedFromFingerprint(fp: string): number {
  let h = 2166136261
  for (let i = 0; i < fp.length; i++) {
    h ^= fp.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0 || 1
}

export function useSeasonForecast({
  enabled,
  baseStandings,
  remaining,
  league,
  fixedScenarios,
  playedScores = [],
  runs = DEFAULT_SIMULATIONS,
}: Args) {
  const [result, setResult] = useState<SeasonSimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  const fingerprint = useMemo(
    () =>
      fingerprintInput(
        baseStandings,
        remaining,
        league,
        fixedScenarios,
        playedScores,
        runs,
      ),
    [baseStandings, remaining, league, fixedScenarios, playedScores, runs],
  )

  const latest = useRef({
    baseStandings,
    remaining,
    league,
    fixedScenarios,
    playedScores,
    runs,
  })
  latest.current = {
    baseStandings,
    remaining,
    league,
    fixedScenarios,
    playedScores,
    runs,
  }

  useEffect(() => {
    if (!enabled) {
      setResult(null)
      setLoading(false)
      setError(null)
      return
    }

    const {
      baseStandings: standings,
      remaining: open,
      league: lg,
      fixedScenarios: fixed,
      playedScores: played,
      runs: n,
    } = latest.current

    if (standings.length === 0) {
      setResult(null)
      setLoading(false)
      return
    }

    const seed = seedFromFingerprint(fingerprint)
    const id = ++reqId.current

    if (open.length === 0) {
      setLoading(false)
      setError(null)
      setResult(
        runSeasonSimulation({
          baseStandings: standings,
          remaining: [],
          league: lg,
          fixedScenarios: [],
          playedScores: played,
          runs: 1,
          seed,
        }),
      )
      return
    }

    setLoading(true)
    setError(null)

    const input = {
      baseStandings: standings,
      remaining: open,
      league: lg,
      fixedScenarios: fixed,
      playedScores: played,
      runs: n,
      seed,
    }

    let worker: Worker
    try {
      worker = new Worker(new URL('../workers/simulate.ts', import.meta.url), {
        type: 'module',
      })
    } catch {
      try {
        const sync = runSeasonSimulation(input)
        if (reqId.current === id) {
          setResult(sync)
          setLoading(false)
        }
      } catch (err) {
        if (reqId.current === id) {
          setError(err instanceof Error ? err.message : 'Simulation fehlgeschlagen')
          setLoading(false)
        }
      }
      return
    }

    const onMessage = (event: MessageEvent<SimulateWorkerResponse>) => {
      if (event.data.id !== id) return
      if (event.data.ok) setResult(event.data.result)
      else setError(event.data.error)
      setLoading(false)
      worker.terminate()
    }
    const onError = () => {
      if (reqId.current !== id) return
      // Fallback synchron, falls Worker scheitert
      try {
        setResult(runSeasonSimulation(input))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Prognose fehlgeschlagen')
      }
      setLoading(false)
      worker.terminate()
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    const payload: SimulateWorkerRequest = { id, input }
    worker.postMessage(payload)

    return () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate()
    }
  }, [enabled, fingerprint])

  return { result, loading, error }
}
