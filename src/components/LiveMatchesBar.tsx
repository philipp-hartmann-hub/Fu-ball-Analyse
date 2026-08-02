import { useEffect, useRef, useState } from 'react'
import type { LiveMatchView } from '../lib/live'
import { scoreKey } from '../lib/live'

interface Props {
  liveMatches: LiveMatchView[]
  pollMs: number
  refreshing: boolean
}

export function LiveMatchesBar({ liveMatches, pollMs, refreshing }: Props) {
  const prevScores = useRef<Map<number, string>>(new Map())
  const [flashIds, setFlashIds] = useState<Set<number>>(() => new Set())
  const flashTimers = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const nextFlash = new Set<number>()
    const nextPrev = new Map(prevScores.current)

    for (const live of liveMatches) {
      const key = scoreKey(live.homeGoals, live.awayGoals)
      const prev = prevScores.current.get(live.match.matchID)
      if (prev != null && prev !== key) {
        nextFlash.add(live.match.matchID)
        const existing = flashTimers.current.get(live.match.matchID)
        if (existing != null) window.clearTimeout(existing)
        const tid = window.setTimeout(() => {
          setFlashIds((cur) => {
            const copy = new Set(cur)
            copy.delete(live.match.matchID)
            return copy
          })
          flashTimers.current.delete(live.match.matchID)
        }, 1600)
        flashTimers.current.set(live.match.matchID, tid)
      }
      nextPrev.set(live.match.matchID, key)
    }

    // Entfernte Spiele aus Prev-Map
    for (const id of [...nextPrev.keys()]) {
      if (!liveMatches.some((l) => l.match.matchID === id)) {
        nextPrev.delete(id)
      }
    }

    prevScores.current = nextPrev
    if (nextFlash.size > 0) {
      setFlashIds((cur) => {
        const merged = new Set(cur)
        for (const id of nextFlash) merged.add(id)
        return merged
      })
    }
  }, [liveMatches])

  useEffect(() => {
    return () => {
      for (const tid of flashTimers.current.values()) window.clearTimeout(tid)
      flashTimers.current.clear()
    }
  }, [])

  if (liveMatches.length === 0) return null

  const pollSec = Math.round(pollMs / 1000)

  return (
    <section className="live-bar" aria-label="Laufende Spiele">
      <div className="live-bar-head">
        <span className="live-pill">
          <span className="live-dot" aria-hidden />
          Live
        </span>
        <span className="live-meta">
          {liveMatches.length} Partie{liveMatches.length === 1 ? '' : 'n'} · Update alle{' '}
          {pollSec}s
          {refreshing ? ' · …' : ''}
        </span>
      </div>
      <ul className="live-list">
        {liveMatches.map((live) => {
          const m = live.match
          const home = m.team1.shortName || m.team1.teamName
          const away = m.team2.shortName || m.team2.teamName
          const flashed = flashIds.has(m.matchID)
          return (
            <li
              key={m.matchID}
              className={['live-item', flashed ? 'score-flash' : ''].filter(Boolean).join(' ')}
            >
              <span className="live-md">ST {m.group.groupOrderID}</span>
              <span className="live-teams">
                <span className="live-home">{home}</span>
                <span
                  className={['live-score', !live.hasScore ? 'pending' : ''].filter(Boolean).join(' ')}
                >
                  {live.hasScore ? `${live.homeGoals}:${live.awayGoals}` : '–:–'}
                </span>
                <span className="live-away">{away}</span>
              </span>
              {live.resultName && (
                <span className="live-result-name">{live.resultName}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
