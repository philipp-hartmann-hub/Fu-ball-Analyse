import { useState } from 'react'
import type { Match, ScenarioResult } from '../types'
import { scenarioFromOutcome } from '../lib/scenarios'

interface Props {
  matches: Match[]
  scenarios: ScenarioResult[]
  onChange: (scenarios: ScenarioResult[]) => void
  focusTeamId: number | null
}

function outcomeOf(s: ScenarioResult | undefined): 'home' | 'draw' | 'away' | null {
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

export function ScenarioPanel({ matches, scenarios, onChange, focusTeamId }: Props) {
  const [onlyFocus, setOnlyFocus] = useState(false)
  const map = new Map(scenarios.map((s) => [s.matchId, s]))

  const setOutcome = (matchId: number, outcome: 'home' | 'draw' | 'away' | null) => {
    const next = scenarios.filter((s) => s.matchId !== matchId)
    if (outcome) next.push(scenarioFromOutcome(matchId, outcome))
    onChange(next)
  }

  const filtered =
    onlyFocus && focusTeamId != null
      ? matches.filter(
          (m) => m.team1.teamId === focusTeamId || m.team2.teamId === focusTeamId,
        )
      : matches

  const byMatchday = new Map<number, Match[]>()
  for (const m of filtered) {
    const day = m.group.groupOrderID
    if (!byMatchday.has(day)) byMatchday.set(day, [])
    byMatchday.get(day)!.push(m)
  }

  const days = [...byMatchday.keys()].sort((a, b) => a - b)

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
      <p className="hint">
        1 / X / 2 setzen – die Tabelle und Δ-Spalte aktualisieren sich sofort.
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
      <div className="matchday-list">
        {days.map((day) => (
          <section key={day} className="matchday-block">
            <h3>{day}. Spieltag</h3>
            <ul className="fixture-list">
              {(byMatchday.get(day) ?? []).map((match) => {
                const current = outcomeOf(map.get(match.matchID))
                const involvesFocus =
                  focusTeamId != null &&
                  (match.team1.teamId === focusTeamId || match.team2.teamId === focusTeamId)
                return (
                  <li key={match.matchID} className={involvesFocus ? 'focus' : ''}>
                    <div className="fixture-meta">
                      <span className="fixture-date">{formatDate(match.matchDateTime)}</span>
                      <div className="fixture-teams">
                        <span>{match.team1.shortName || match.team1.teamName}</span>
                        <span className="vs">–</span>
                        <span>{match.team2.shortName || match.team2.teamName}</span>
                      </div>
                    </div>
                    <div className="outcome-btns" role="group" aria-label="Ergebnis">
                      {(
                        [
                          ['home', '1'],
                          ['draw', 'X'],
                          ['away', '2'],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={current === key ? 'active' : ''}
                          onClick={() =>
                            setOutcome(match.matchID, current === key ? null : key)
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="hint">Kein Restspiel für den gewählten Verein – anderen Verein wählen.</p>
      )}
    </div>
  )
}
