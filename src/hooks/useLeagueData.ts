import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLeagueMatches } from '../api/dataSource'
import type { League } from '../leagues'
import type { Match } from '../types'
import { LIVE_POLL_MS, POLL_MS, listLiveMatches } from '../lib/live'
import { readLeagueCache, writeLeagueCache } from '../lib/leagueCache'

export function useLeagueData(leagueId: string, season: number) {
  const [matches, setMatches] = useState<Match[]>([])
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [fromCache, setFromCache] = useState(false)
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
        const now = new Date()
        setMatches(next.matches)
        setLeague(next.league)
        setUpdatedAt(now)
        setFromCache(false)
        writeLeagueCache(leagueId, season, next.matches, next.league, now)
      } catch (e) {
        if (ac.signal.aborted) return
        // Bei stillem Refresh vorhandene (Cache-)Daten behalten
        if (!silent) {
          setMatches([])
          setLeague(null)
          setUpdatedAt(null)
          setFromCache(false)
        }
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

  // Cache hydratisieren, dann laden (silent wenn Cache da)
  useEffect(() => {
    const cached = readLeagueCache(leagueId, season)
    if (cached) {
      setMatches(cached.matches)
      setLeague(cached.league)
      setUpdatedAt(new Date(cached.updatedAt))
      setLoading(false)
      setError(null)
      setFromCache(true)
      void load(true)
    } else {
      setMatches([])
      setLeague(null)
      setUpdatedAt(null)
      setFromCache(false)
      void load(false)
    }
    return () => {
      abortRef.current?.abort()
    }
  }, [load, leagueId, season])

  // Polling: nur Timer cleanup, kein Abort
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
    fromCache,
    reload: () => load(false),
    liveMatches,
    pollMs,
  }
}
