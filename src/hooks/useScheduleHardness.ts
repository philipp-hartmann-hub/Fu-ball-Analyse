import { useEffect, useMemo, useRef, useState } from 'react'
import type { Match, StandingRow } from '../types'
import { computeScheduleHardness, type ScheduleHardness } from '../lib/schedule'
import { deriveTeamStrengths } from '../lib/simulation'

function standingsFingerprint(standings: StandingRow[]): string {
  return standings
    .map((s) =>
      [
        s.teamId,
        s.points,
        s.goalDiff,
        s.goalsFor,
        s.goalsAgainst,
        s.played,
      ].join(':'),
    )
    .join('|')
}

function deferAfterPaint(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout: 120 })
    return () => cancelIdleCallback(id)
  }
  const t = window.setTimeout(fn, 0)
  return () => window.clearTimeout(t)
}

interface Args {
  enabled: boolean
  /** Stabile Datenversion (Poll ohne Inhaltsänderung → kein Re-Run) */
  dataVersion: string
  openMatches: Match[]
  /** Abgeschlossene Spiele für gegner-adjustierte Stärken */
  playedMatches: Match[]
  baseStandings: StandingRow[]
  /** Zuerst nur diese Vereine (Vereins-/Vergleichsansicht) */
  priorityTeamIds?: readonly number[]
}

export function useScheduleHardness({
  enabled,
  dataVersion,
  openMatches,
  playedMatches,
  baseStandings,
  priorityTeamIds = [],
}: Args) {
  const [hardnessByTeam, setHardnessByTeam] = useState<
    Map<number, ScheduleHardness>
  >(() => new Map())
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        dataVersion,
        remaining: openMatches.map((m) => m.matchID).join(','),
        played: playedMatches.map((m) => m.matchID).join(','),
        standings: standingsFingerprint(baseStandings),
      }),
    [dataVersion, openMatches, playedMatches, baseStandings],
  )

  const latest = useRef({
    openMatches,
    playedMatches,
    baseStandings,
    priorityTeamIds,
  })
  latest.current = { openMatches, playedMatches, baseStandings, priorityTeamIds }

  useEffect(() => {
    if (!enabled || baseStandings.length === 0) {
      setHardnessByTeam(new Map())
      setLoading(false)
      return
    }

    const id = ++reqId.current
    setLoading(true)

    const cancelDefer = deferAfterPaint(() => {
      if (reqId.current !== id) return

      const {
        openMatches: open,
        playedMatches: played,
        baseStandings: standings,
        priorityTeamIds: priority,
      } = latest.current

      try {
        const precomputedStrengths = deriveTeamStrengths(standings, played)

        if (priority.length > 0) {
          const partial = computeScheduleHardness(open, standings, {
            precomputedStrengths,
            playedMatches: played,
            onlyTeamIds: priority,
          })
          if (reqId.current === id) {
            setHardnessByTeam((prev) => {
              const next = new Map(prev)
              for (const row of partial) next.set(row.teamId, row)
              return next
            })
          }
        }

        const full = computeScheduleHardness(open, standings, {
          precomputedStrengths,
          playedMatches: played,
        })
        if (reqId.current === id) {
          setHardnessByTeam(new Map(full.map((h) => [h.teamId, h])))
          setLoading(false)
        }
      } catch {
        if (reqId.current === id) {
          setHardnessByTeam(new Map())
          setLoading(false)
        }
      }
    })

    return () => {
      cancelDefer()
    }
  }, [enabled, fingerprint, baseStandings.length])

  return { hardnessByTeam, loading }
}
