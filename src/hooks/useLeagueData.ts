import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLeagueMatches } from '../api/dataSource'
import type { League } from '../leagues'
import type { Match } from '../types'
import { LIVE_POLL_MS, POLL_MS, listLiveMatches } from '../lib/live'
import { readLeagueCache, writeLeagueCache } from '../lib/leagueCache'
import { matchesContentSignature } from '../lib/matchSignature'

/** Nutzerfreundliche Fehlertexte — Rohdetails nur in die Konsole. */
export function friendlyLoadError(err: unknown): string {
  console.error('[useLeagueData]', err)
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('abort')) return 'Laden abgebrochen.'
    if (msg.includes('parse') || msg.includes('json') || msg.includes('zod')) {
      return 'Antwortdaten konnten nicht gelesen werden.'
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed')) {
      return 'Verbindung zur Datenquelle fehlgeschlagen.'
    }
  }
  return 'Ligadaten konnten nicht geladen werden.'
}

export function useLeagueData(leagueId: string, season: number) {
  const [matches, setMatches] = useState<Match[]>([])
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const matchesRef = useRef<Match[]>([])
  matchesRef.current = matches

  const liveMatches = useMemo(() => listLiveMatches(matches), [matches])
  const pollMs = liveMatches.length > 0 ? LIVE_POLL_MS : POLL_MS

  const load = useCallback(
    async (silent = false) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      if (!silent) setLoading(true)
      else setRefreshing(true)
      if (!silent) setError(null)

      try {
        const next = await fetchLeagueMatches(leagueId, season)
        if (ac.signal.aborted) return

        const prev = matchesRef.current
        if (
          silent &&
          prev.length > 0 &&
          matchesContentSignature(next.matches) === matchesContentSignature(prev)
        ) {
          // Identische Daten: Referenz & updatedAt stabil halten → keine Recompute-Kaskade
          setLeague(next.league)
          setFromCache(false)
          setError(null)
          return
        }

        const now = new Date()
        setMatches(next.matches)
        setLeague(next.league)
        setUpdatedAt(now)
        setFromCache(false)
        setError(null)
        writeLeagueCache(leagueId, season, next.matches, next.league, now)
      } catch (e) {
        if (ac.signal.aborted) return
        const friendly = friendlyLoadError(e)
        // Nie angezeigte Daten leeren, wenn schon welche da sind (Cache/Refresh)
        if (!silent && matchesRef.current.length === 0) {
          setMatches([])
          setLeague(null)
          setUpdatedAt(null)
          setFromCache(false)
        }
        setError(friendly)
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
