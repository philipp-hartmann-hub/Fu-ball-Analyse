import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCompetitionMatches } from '../api/dataSource'
import type { Competition } from '../competitions'
import type { Match } from '../types'

const POLL_MS = 60_000

export function useLeagueData(competitionId: string, season: number) {
  const [matches, setMatches] = useState<Match[]>([])
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
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
        const next = await fetchCompetitionMatches(competitionId, season)
        if (ac.signal.aborted) return
        setMatches(next.matches)
        setCompetition(next.competition)
        setProvider(next.provider)
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
    [competitionId, season],
  )

  useEffect(() => {
    void load(false)
    const id = window.setInterval(() => void load(true), POLL_MS)
    return () => {
      window.clearInterval(id)
      abortRef.current?.abort()
    }
  }, [load])

  return {
    matches,
    competition,
    provider,
    loading,
    error,
    updatedAt,
    refreshing,
    reload: () => load(false),
  }
}
