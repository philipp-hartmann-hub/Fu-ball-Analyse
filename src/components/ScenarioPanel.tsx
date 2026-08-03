import { useEffect, useMemo, useState } from 'react'
import type { Match, ScenarioResult } from '../types'
import { scenarioFromOutcome, scenarioFromScore } from '../lib/scenarios'

interface Props {
  matches: Match[]
  scenarios: ScenarioResult[]
  onChange: (scenarios: ScenarioResult[]) => void
  focusTeamId: number | null
}

type DetailMode = 'grob' | 'fein'
type Coarse = 'home' | 'draw' | 'away'

function outcomeOf(s: ScenarioResult | undefined): Coarse | null {
  if (!s) return null
  if (s.homeGoals > s.awayGoals) return 'home'
  if (s.homeGoals < s.awayGoals) return 'away'
  return 'draw'
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

/** Nur Ziffern, max. 20; leeres Feld → 0 */
function parseGoals(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return Math.min(20, Number(digits))
}

function Crest({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      <img
        className="crest-img scenario-crest"
        src={url}
        alt=""
        width={22}
        height={22}
        title={name}
        loading="lazy"
      />
    )
  }
  return (
    <span className="crest-fallback scenario-crest" aria-hidden title={name} />
  )
}

export function ScenarioPanel({
  matches,
  scenarios,
  onChange,
  focusTeamId,
}: Props) {
  const [onlyFocus, setOnlyFocus] = useState(false)
  const [mode, setMode] = useState<DetailMode>('grob')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const map = new Map(scenarios.map((s) => [s.matchId, s]))

  const openDays = useMemo(() => {
    const set = new Set(matches.map((m) => m.group.groupOrderID))
    return [...set].sort((a, b) => a - b)
  }, [matches])

  // Default immer der nächste offene Spieltag
  useEffect(() => {
    if (openDays.length === 0) {
      setSelectedDay(null)
      return
    }
    setSelectedDay((prev) =>
      prev != null && openDays.includes(prev) ? prev : openDays[0]!,
    )
  }, [openDays])

  const activeDay = selectedDay ?? openDays[0] ?? null

  const dayMatches = useMemo(() => {
    if (activeDay == null) return []
    return matches.filter((m) => m.group.groupOrderID === activeDay)
  }, [matches, activeDay])

  const fixtures = useMemo(() => {
    if (onlyFocus && focusTeamId != null) {
      return dayMatches.filter(
        (m) => m.team1.teamId === focusTeamId || m.team2.teamId === focusTeamId,
      )
    }
    return dayMatches
  }, [dayMatches, onlyFocus, focusTeamId])

  const upsert = (result: ScenarioResult | null, matchId: number) => {
    const next = scenarios.filter((s) => s.matchId !== matchId)
    if (result) next.push(result)
    onChange(next)
  }

  const setCoarse = (matchId: number, outcome: Coarse | null) => {
    if (!outcome) {
      upsert(null, matchId)
      return
    }
    const existing = map.get(matchId)
    if (existing && outcomeOf(existing) === outcome) {
      return
    }
    upsert(scenarioFromOutcome(matchId, outcome), matchId)
  }

  const setFine = (matchId: number, homeGoals: number, awayGoals: number) => {
    upsert(scenarioFromScore(matchId, homeGoals, awayGoals), matchId)
  }

  const dayIndex = activeDay != null ? openDays.indexOf(activeDay) : -1
  const canPrev = dayIndex > 0
  const canNext = dayIndex >= 0 && dayIndex < openDays.length - 1

  if (matches.length === 0) {
    return (
      <div className="panel empty">
        <p>Keine offenen Spiele – Saison abgeschlossen oder noch nicht gestartet.</p>
        <p className="hint">
          Aktiviere „Stand nach Spieltag“, um Restspiele ab einem früheren Stand zu
          simulieren.
        </p>
      </div>
    )
  }

  return (
    <div className="panel scenario-panel">
      <div className="panel-head">
        <h2>Szenario-Simulator</h2>
        <button
          type="button"
          className="ghost"
          onClick={() => onChange([])}
          disabled={!scenarios.length}
        >
          Zurücksetzen
        </button>
      </div>

      <div className="matchday-picker">
        <button
          type="button"
          className="ghost matchday-nav"
          disabled={!canPrev}
          aria-label="Vorheriger Spieltag"
          onClick={() => {
            if (canPrev) setSelectedDay(openDays[dayIndex - 1]!)
          }}
        >
          ‹
        </button>
        <label className="matchday-select-wrap">
          <span className="sr-only">Spieltag wählen</span>
          <select
            value={activeDay ?? ''}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            aria-label="Spieltag durchspielen"
          >
            {openDays.map((day) => (
              <option key={day} value={day}>
                {day}. Spieltag
                {day === openDays[0] ? ' (nächster)' : ''}
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
            if (canNext) setSelectedDay(openDays[dayIndex + 1]!)
          }}
        >
          ›
        </button>
      </div>

      <div className="scenario-modes" role="tablist" aria-label="Eingabemodus">
        <button
          type="button"
          role="tab"
          className={mode === 'grob' ? 'active' : ''}
          aria-selected={mode === 'grob'}
          onClick={() => setMode('grob')}
        >
          Grob
        </button>
        <button
          type="button"
          role="tab"
          className={mode === 'fein' ? 'active' : ''}
          aria-selected={mode === 'fein'}
          onClick={() => setMode('fein')}
        >
          Fein
        </button>
      </div>
      <p className="hint">
        {mode === 'grob'
          ? '1 = Heim siegt, X = Unentschieden, 2 = Auswärts siegt.'
          : 'Tore tippen (Heim : Auswärts). Ohne Auswahl gilt 0:0 beim Fokus der Felder.'}
      </p>

      <label className="toggle compact">
        <input
          type="checkbox"
          checked={onlyFocus}
          disabled={focusTeamId == null}
          onChange={(e) => setOnlyFocus(e.target.checked)}
        />
        Nur Spiele des Fokusvereins
      </label>

      <div className="matchday-list single-day">
        <ul className="fixture-list">
          {fixtures.map((match) => {
            const scenario = map.get(match.matchID)
            const current = outcomeOf(scenario)
            const involvesFocus =
              focusTeamId != null &&
              (match.team1.teamId === focusTeamId ||
                match.team2.teamId === focusTeamId)
            const homeGoals = scenario?.homeGoals ?? 0
            const awayGoals = scenario?.awayGoals ?? 0
            const homeName = match.team1.shortName || match.team1.teamName
            const awayName = match.team2.shortName || match.team2.teamName

            return (
              <li key={match.matchID} className={involvesFocus ? 'focus' : ''}>
                <div className="fixture-meta">
                  <span className="fixture-date">{formatDate(match.matchDateTime)}</span>
                  <div className="fixture-teams with-crests">
                    <span className="fixture-side">
                      <Crest url={match.team1.teamIconUrl} name={homeName} />
                      {homeName}
                    </span>
                    <span className="vs">–</span>
                    <span className="fixture-side away">
                      {awayName}
                      <Crest url={match.team2.teamIconUrl} name={awayName} />
                    </span>
                  </div>
                </div>

                {mode === 'grob' ? (
                  <div className="outcome-btns coarse" role="group" aria-label="Grob-Ergebnis">
                    {(
                      [
                        {
                          key: 'home' as const,
                          label: `Sieg ${homeName}`,
                          short: '1',
                        },
                        {
                          key: 'draw' as const,
                          label: 'Unentschieden',
                          short: 'X',
                        },
                        {
                          key: 'away' as const,
                          label: `Sieg ${awayName}`,
                          short: '2',
                        },
                      ] as const
                    ).map(({ key, label, short }) => (
                      <button
                        key={key}
                        type="button"
                        title={label}
                        className={current === key ? 'active' : ''}
                        onClick={() =>
                          setCoarse(match.matchID, current === key ? null : key)
                        }
                      >
                        {short}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="score-inputs" aria-label="Feinergebnis">
                    <label>
                      <span className="sr-only">Tore Heim</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        maxLength={2}
                        value={scenario ? String(homeGoals) : ''}
                        placeholder="0"
                        onChange={(e) =>
                          setFine(
                            match.matchID,
                            parseGoals(e.target.value),
                            scenario ? awayGoals : 0,
                          )
                        }
                        onFocus={() => {
                          if (!scenario) setFine(match.matchID, 0, 0)
                        }}
                      />
                    </label>
                    <span className="score-sep">:</span>
                    <label>
                      <span className="sr-only">Tore Auswärts</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        maxLength={2}
                        value={scenario ? String(awayGoals) : ''}
                        placeholder="0"
                        onChange={(e) =>
                          setFine(
                            match.matchID,
                            scenario ? homeGoals : 0,
                            parseGoals(e.target.value),
                          )
                        }
                        onFocus={() => {
                          if (!scenario) setFine(match.matchID, 0, 0)
                        }}
                      />
                    </label>
                    {scenario && (
                      <button
                        type="button"
                        className="ghost score-clear"
                        onClick={() => upsert(null, match.matchID)}
                        title="Ergebnis entfernen"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {fixtures.length === 0 && (
        <p className="hint">
          {onlyFocus
            ? 'Kein Spiel des Fokusvereins an diesem Spieltag – anderen Spieltag wählen.'
            : 'Keine Spiele an diesem Spieltag.'}
        </p>
      )}
    </div>
  )
}
