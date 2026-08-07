import { useEffect, useMemo, useRef, useState } from 'react'
import type { Match, ScenarioResult, StandingRow } from '../types'
import {
  halfTimeResult,
  listMatchGoals,
  listMatchdayFixtures,
  resolveResultsMatchday,
  scoreKey,
  type MatchdayFixtureView,
} from '../lib/live'
import { predictFixture } from '../lib/simulation'
import type { ExplainTopic } from '../lib/modelExplanations'
import { MatchPredictionCard } from './MatchPredictionCard'

interface Props {
  matches: Match[]
  pollMs: number
  refreshing: boolean
  /** Anzahl wirklich laufender Partien (für Live-Pill) */
  liveCount: number
  /** bar = unter der Tabelle (legacy); panel = Seitenleisten-Reiter */
  variant?: 'bar' | 'panel'
  /** Für Spielschätzung 1/X/2 (wie Vereinsübersicht) */
  standings?: StandingRow[]
  scenarios?: ScenarioResult[]
  onExplain?: (topic: ExplainTopic) => void
}

function Crest({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      <img
        className="crest-img live-crest"
        src={url}
        alt=""
        width={22}
        height={22}
        title={name}
        loading="lazy"
      />
    )
  }
  return <span className="crest-fallback live-crest" aria-hidden title={name} />
}

export function LiveMatchesBar({
  matches,
  pollMs,
  refreshing,
  liveCount,
  variant = 'panel',
  standings = [],
  scenarios = [],
  onExplain,
}: Props) {
  const allDays = useMemo(
    () =>
      [...new Set(matches.map((m) => m.group.groupOrderID))].sort((a, b) => a - b),
    [matches],
  )
  const defaultDay = useMemo(() => resolveResultsMatchday(matches), [matches])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    setSelectedDay((prev) => {
      if (allDays.length === 0) return null
      if (prev != null && allDays.includes(prev)) return prev
      return defaultDay ?? allDays[0]!
    })
  }, [allDays, defaultDay])

  const matchday = selectedDay ?? defaultDay

  useEffect(() => {
    setExpandedId(null)
  }, [matchday])

  const fixtures = useMemo(
    () => (matchday != null ? listMatchdayFixtures(matches, matchday) : []),
    [matches, matchday],
  )

  const dayIndex = matchday != null ? allDays.indexOf(matchday) : -1
  const canPrev = dayIndex > 0
  const canNext = dayIndex >= 0 && dayIndex < allDays.length - 1

  const prevScores = useRef<Map<number, string>>(new Map())
  const [flashIds, setFlashIds] = useState<Set<number>>(() => new Set())
  const flashTimers = useRef<Map<number, number>>(new Map())
  const [open, setOpen] = useState(variant === 'panel' || liveCount > 0)

  useEffect(() => {
    if (variant === 'panel') {
      setOpen(true)
      return
    }
    if (liveCount > 0) setOpen(true)
  }, [liveCount, variant])

  useEffect(() => {
    const nextFlash = new Set<number>()
    const nextPrev = new Map(prevScores.current)

    for (const row of fixtures) {
      if (row.status === 'upcoming') continue
      const key = scoreKey(row.homeGoals, row.awayGoals)
      const prev = prevScores.current.get(row.match.matchID)
      if (prev != null && prev !== key) {
        nextFlash.add(row.match.matchID)
        const existing = flashTimers.current.get(row.match.matchID)
        if (existing != null) window.clearTimeout(existing)
        const tid = window.setTimeout(() => {
          setFlashIds((cur) => {
            const copy = new Set(cur)
            copy.delete(row.match.matchID)
            return copy
          })
          flashTimers.current.delete(row.match.matchID)
        }, 1600)
        flashTimers.current.set(row.match.matchID, tid)
      }
      nextPrev.set(row.match.matchID, key)
    }

    for (const id of [...nextPrev.keys()]) {
      if (!fixtures.some((f) => f.match.matchID === id)) nextPrev.delete(id)
    }

    prevScores.current = nextPrev
    if (nextFlash.size > 0) {
      setFlashIds((cur) => {
        const merged = new Set(cur)
        for (const id of nextFlash) merged.add(id)
        return merged
      })
    }
  }, [fixtures])

  useEffect(() => {
    const timers = flashTimers.current
    return () => {
      for (const tid of timers.values()) window.clearTimeout(tid)
      timers.clear()
    }
  }, [])

  if (allDays.length === 0 || matchday == null) {
    if (variant === 'panel') {
      return (
        <div className="panel live-panel">
          <h2>Ergebnisse</h2>
          <p className="hint">Aktuell kein Spieltag mit Partien verfügbar.</p>
        </div>
      )
    }
    return null
  }

  const pollSec = Math.round(pollMs / 1000)
  const finished = fixtures.filter((f) => f.status === 'finished').length
  const live = fixtures.filter((f) => f.status === 'live').length
  const upcoming = fixtures.filter((f) => f.status === 'upcoming').length

  const meta = (
    <>
      {finished}/{fixtures.length} beendet
      {live > 0 ? ` · ${live} live` : ''}
      {upcoming > 0 ? ` · ${upcoming} offen` : ''}
      {live > 0 ? ` · Update ${pollSec}s` : ''}
      {refreshing ? ' · …' : ''}
      {' · Tippe auf ein Spiel für Details'}
    </>
  )

  const picker = (
    <div className="matchday-picker live-day-picker">
      <button
        type="button"
        className="ghost matchday-nav"
        disabled={!canPrev}
        aria-label="Vorheriger Spieltag"
        onClick={() => {
          if (canPrev) setSelectedDay(allDays[dayIndex - 1]!)
        }}
      >
        ‹
      </button>
      <label className="matchday-select-wrap">
        <span className="sr-only">Spieltag wählen</span>
        <select
          value={matchday}
          onChange={(e) => setSelectedDay(Number(e.target.value))}
          aria-label="Spieltag wählen"
        >
          {allDays.map((day) => (
            <option key={day} value={day}>
              {day}. Spieltag
              {day === defaultDay ? ' (aktuell)' : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="ghost matchday-nav"
        disabled={!canNext}
        aria-label="Nächster Spieltag"
        onClick={() => {
          if (canNext) setSelectedDay(allDays[dayIndex + 1]!)
        }}
      >
        ›
      </button>
    </div>
  )

  const list =
    fixtures.length === 0 ? (
      <p className="hint tight">Keine Partien an diesem Spieltag.</p>
    ) : (
      <ul className="live-list">
        {fixtures.map((row) => (
          <FixtureRow
            key={row.match.matchID}
            row={row}
            flashed={flashIds.has(row.match.matchID)}
            showCrests={variant === 'panel'}
            expanded={expandedId === row.match.matchID}
            onToggle={() =>
              setExpandedId((cur) =>
                cur === row.match.matchID ? null : row.match.matchID,
              )
            }
            standings={standings}
            scenarios={scenarios}
            onExplain={onExplain}
          />
        ))}
      </ul>
    )

  if (variant === 'panel') {
    return (
      <section className="panel live-panel" aria-label={`Ergebnisse Spieltag ${matchday}`}>
        <div className="live-panel-head">
          <div>
            <h2>Ergebnisse</h2>
            <p className="meta live-panel-meta">{meta}</p>
          </div>
          {live > 0 ? (
            <span className="live-pill">
              <span className="live-dot" aria-hidden />
              Live
            </span>
          ) : (
            <span className="live-pill muted">Spieltag</span>
          )}
        </div>
        {picker}
        {list}
      </section>
    )
  }

  return (
    <section className="live-bar live-bar-below" aria-label={`Spieltag ${matchday}`}>
      <button
        type="button"
        className="live-bar-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="live-bar-toggle-main">
          {live > 0 ? (
            <span className="live-pill">
              <span className="live-dot" aria-hidden />
              Live
            </span>
          ) : (
            <span className="live-pill muted">Spieltag</span>
          )}
          <span className="live-bar-title">{matchday}. Spieltag</span>
          <span className="live-meta">{meta}</span>
        </span>
        <span className="live-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <>
          {picker}
          {list}
        </>
      )}
    </section>
  )
}

function FixtureRow({
  row,
  flashed,
  showCrests,
  expanded,
  onToggle,
  standings,
  scenarios,
  onExplain,
}: {
  row: MatchdayFixtureView
  flashed: boolean
  showCrests: boolean
  expanded: boolean
  onToggle: () => void
  standings: StandingRow[]
  scenarios: ScenarioResult[]
  onExplain?: (topic: ExplainTopic) => void
}) {
  const m = row.match
  const home = m.team1.shortName || m.team1.teamName
  const away = m.team2.shortName || m.team2.teamName
  const score =
    row.status === 'upcoming'
      ? '–:–'
      : row.hasScore
        ? `${row.homeGoals}:${row.awayGoals}`
        : '–:–'

  const goals = useMemo(() => listMatchGoals(m), [m])
  const ht = useMemo(() => halfTimeResult(m), [m])
  const showPrediction = row.status === 'upcoming' || row.status === 'live'
  const detailId = `match-detail-${m.matchID}`

  const prediction = useMemo(() => {
    if (!expanded || !showPrediction || standings.length === 0) return null
    return predictFixture(standings, m, { scenarios })
  }, [expanded, showPrediction, standings, m, scenarios])

  return (
    <li
      className={[
        'live-item',
        showCrests ? 'with-crests' : '',
        `status-${row.status}`,
        flashed ? 'score-flash' : '',
        expanded ? 'is-expanded' : '',
        'is-expandable',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="live-item-main"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
      >
        <span className="live-teams">
          <span className="live-home">
            {showCrests && <Crest url={m.team1.teamIconUrl} name={home} />}
            {home}
          </span>
          <span
            className={[
              'live-score',
              row.status === 'upcoming' || !row.hasScore ? 'pending' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {score}
          </span>
          <span className="live-away">
            {away}
            {showCrests && <Crest url={m.team2.teamIconUrl} name={away} />}
          </span>
        </span>
        <span className="live-result-name">
          {row.status === 'upcoming' ? (
            row.kickoffLabel
          ) : row.status === 'live' ? (
            <span className="live-running-badge">
              <span className="live-dot" aria-hidden />
              LIVE · Zwischenstand
            </span>
          ) : (
            row.resultName || row.kickoffLabel
          )}
        </span>
        <span className="live-expand-chevron" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div className="live-match-detail" id={detailId}>
          {row.status === 'live' && (
            <p className="live-interim-note" role="status">
              Spiel läuft – Zwischenstand, noch nicht final. Tore aktualisieren sich
              automatisch.
            </p>
          )}

          {showPrediction && (
            <MatchPredictionCard
              prediction={prediction}
              perspective="neutral"
              title="Spielschätzung"
              homeName={home}
              awayName={away}
              onExplain={onExplain}
              compact
            />
          )}

          {row.status !== 'upcoming' && (
            <>
              {ht && (
                <p className="live-ht">
                  Halbzeit {ht.pointsTeam1}:{ht.pointsTeam2}
                </p>
              )}
              {goals.length > 0 ? (
                <ul className="goal-list">
                  {goals.map((g) => (
                    <li
                      key={g.key}
                      className={`goal-row side-${g.side}`}
                    >
                      <span className="goal-minute">
                        {g.minute != null ? `${g.minute}'` : '–'}
                        {g.isOvertime ? '+' : ''}
                      </span>
                      <span className="goal-body">
                        <span className="goal-name">{g.name}</span>
                        {g.isPenalty && (
                          <span className="goal-tag">Elfmeter</span>
                        )}
                        {g.isOwnGoal && (
                          <span className="goal-tag">Eigentor</span>
                        )}
                        {g.scoreLabel && (
                          <span className="goal-score">{g.scoreLabel}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint tight">
                  {row.status === 'live'
                    ? 'Noch keine Tore erfasst – aktualisiert sich live.'
                    : 'Keine Torschützen in den Daten.'}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}
