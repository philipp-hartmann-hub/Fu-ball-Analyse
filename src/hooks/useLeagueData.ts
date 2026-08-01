import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchLeagueBundle } from '../api/openliga'
import type { LeagueShortcut, Match } from '../types'

const POLL_MS = 60_000

export function useLeagueData(league: LeagueShortcut, season: number) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (silent = false) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      if (!silent) setLoading(true)
      else setRefreshing(true)
      setError(null)

      try {
        const { matches: next } = await fetchLeagueBundle(league, season)
        if (ac.signal.aborted) return
        setMatches(next)
        setUpdatedAt(new Date())
      } catch (e) {
        if (ac.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
      } finally {
        if (!ac.signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [league, season],
  )

  useEffect(() => {
    void load(false)
    const id = window.setInterval(() => void load(true), POLL_MS)
    return () => {
      window.clearInterval(id)
      abortRef.current?.abort()
    }
  }, [load])

  return { matches, loading, error, updatedAt, refreshing, reload: () => load(false) }
}
