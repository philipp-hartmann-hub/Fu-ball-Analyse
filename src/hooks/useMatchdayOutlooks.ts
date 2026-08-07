import { useEffect, useMemo, useRef, useState } from 'react'
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
import type {
  ScenariosWorkerRequest,
  ScenariosWorkerResponse,
} from '../workers/scenarios'

function fingerprintMatchday(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  priorScores: MatchScore[],
  target: number,
  comparator: TargetComparator,
): string {
  return JSON.stringify({
    teamId,
    target,
    comparator,
    standings: baseStandings.map((s) => [
      s.teamId,
      s.points,
      s.goalDiff,
      s.goalsFor,
      s.goalsAgainst,
      s.played,
      s.rank,
    ]),
    remaining: remaining.map((m) => m.matchID),
    played: priorScores.map((s) => [
      s.matchId,
      s.homeId,
      s.awayId,
      s.homeGoals,
      s.awayGoals,
    ]),
  })
}

interface Args {
  enabled: boolean
  baseStandings: StandingRow[]
  remaining: Match[]
  teamId: number | null
  priorScores: MatchScore[]
  targetRank: number
  comparator: TargetComparator
}

/**
 * Spieltag-Best/Schlecht + Wunschplatz asynchron (Worker), Fingerprint-Gating.
 * Fallback: Sync auf dem Main-Thread wenn Worker fehlt.
 */
export function useMatchdayOutlooks({
  enabled,
  baseStandings,
  remaining,
  teamId,
  priorScores,
  targetRank,
  comparator,
}: Args) {
  const [outlook, setOutlook] = useState<NextMatchdayOutlook | null>(null)
  const [targetOutlook, setTargetOutlook] = useState<TargetOutlook | null>(null)
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)
  const workerRef = useRef<Worker | null>(null)

  const fingerprint = useMemo(() => {
    if (!enabled || teamId == null || baseStandings.length === 0) return ''
    return fingerprintMatchday(
      baseStandings,
      remaining,
      teamId,
      priorScores,
      targetRank,
      comparator,
    )
  }, [
    enabled,
    baseStandings,
    remaining,
    teamId,
    priorScores,
    targetRank,
    comparator,
  ])

  useEffect(() => {
    if (!fingerprint || teamId == null) {
      setOutlook(null)
      setTargetOutlook(null)
      setLoading(false)
      return
    }

    const id = ++reqId.current
    setLoading(true)

    const runSync = () => {
      if (id !== reqId.current) return
      setOutlook(
        computeNextMatchdayOutlook(
          baseStandings,
          remaining,
          teamId,
          priorScores,
        ),
      )
      setTargetOutlook(
        computeTargetMatchdayOutlook(
          baseStandings,
          remaining,
          teamId,
          targetRank,
          comparator,
          priorScores,
        ),
      )
      setLoading(false)
    }

    try {
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL('../workers/scenarios.ts', import.meta.url),
          { type: 'module' },
        )
      }
      const worker = workerRef.current

      let pending = 2
      let matchdayDone = false
      let targetDone = false

      const onMessage = (event: MessageEvent<ScenariosWorkerResponse>) => {
        if (event.data.id !== id) return
        if (!event.data.ok) {
          worker.removeEventListener('message', onMessage)
          runSync()
          return
        }
        if (event.data.kind === 'matchday') {
          setOutlook(event.data.result)
          matchdayDone = true
        } else {
          setTargetOutlook(event.data.result)
          targetDone = true
        }
        pending -= 1
        if (pending <= 0 && matchdayDone && targetDone) {
          worker.removeEventListener('message', onMessage)
          if (id === reqId.current) setLoading(false)
        }
      }

      worker.addEventListener('message', onMessage)

      const baseMsg = {
        id,
        baseStandings,
        remaining,
        teamId,
        priorScores,
      }
      const md: ScenariosWorkerRequest = { ...baseMsg, kind: 'matchday' }
      const tg: ScenariosWorkerRequest = {
        ...baseMsg,
        kind: 'target',
        target: targetRank,
        comparator,
      }
      worker.postMessage(md)
      worker.postMessage(tg)
    } catch {
      runSync()
    }

    return () => {
      // stale responses ignored via reqId
    }
  }, [fingerprint, teamId, baseStandings, remaining, priorScores, targetRank, comparator])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  return { outlook, targetOutlook, loading }
}
