import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLeagueMatches } from '../api/dataSource'
import type { League } from '../leagues'
import type { Match } from '../types'
import { LIVE_POLL_MS, POLL_MS, listLiveMatches } from '../lib/live'

export function useLeagueData(leagueId: string, season: number) {
  const [matches, setMatches] = useState<Match[]>([])
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const liveMatches = useMemo(() => listLiveMatches(matches), [matches])
  const pollMs = liveMatches.length > 0 ? LIVE_POLL_MS : POLL_MS

  const load = useCallback(
    async (silent = false) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      if (!silent) setLoading(true)
      else setRefreshing(true)
      setError(null)

      try {
        const next = await fetchLeagueMatches(leagueId, season)
        if (ac.signal.aborted) return
        setMatches(next.matches)
        setLeague(next.league)
        setUpdatedAt(new Date())
      } catch (e) {
        if (ac.signal.aborted) return
        setMatches([])
        setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [leagueId, season],
  )

  // Erstladen / Liga- oder Saisonwechsel – Abort nur hier beim Teardown
  useEffect(() => {
    void load(false)
    return () => {
      abortRef.current?.abort()
    }
  }, [load])

  // Polling: Intervall wechseln ohne den Aktiven Request unnötig zu killen
  // (Cleanup löscht nur den Timer, kein Abort).
  useEffect(() => {
    const id = window.setInterval(() => void load(true), pollMs)
    return () => {
      window.clearInterval(id)
    }
  }, [load, pollMs])

  return {
    matches,
    league,
    loading,
    error,
    updatedAt,
    refreshing,
    reload: () => load(false),
    liveMatches,
    pollMs,
  }
}
