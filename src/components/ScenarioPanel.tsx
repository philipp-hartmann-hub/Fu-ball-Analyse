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

export function ScenarioPanel({ matches, scenarios, onChange, focusTeamId }: Props) {
  const map = new Map(scenarios.map((s) => [s.matchId, s]))

  const setOutcome = (matchId: number, outcome: 'home' | 'draw' | 'away' | null) => {
    const next = scenarios.filter((s) => s.matchId !== matchId)
    if (outcome) next.push(scenarioFromOutcome(matchId, outcome))
    onChange(next)
  }

  const byMatchday = new Map<number, Match[]>()
  for (const m of matches) {
    const day = m.group.groupOrderID
    if (!byMatchday.has(day)) byMatchday.set(day, [])
    byMatchday.get(day)!.push(m)
  }

  const days = [...byMatchday.keys()].sort((a, b) => a - b)
  const visibleDays = days.slice(0, 6)

  if (matches.length === 0) {
    return (
      <div className="panel empty">
        <p>Keine offenen Spiele – die Saison ist abgeschlossen oder noch nicht gestartet.</p>
        <p className="hint">
          Nutze „Stand nach Spieltag“, um aus einer früheren Tabellenkonstellation zu
          analysieren.
        </p>
      </div>
    )
  }

  return (
    <div className="panel scenario-panel">
      <div className="panel-head">
        <h2>Szenario-Simulator</h2>
        <button type="button" className="ghost" onClick={() => onChange([])} disabled={!scenarios.length}>
          Zurücksetzen
        </button>
      </div>
      <p className="hint">
        Tippe Ergebnisse für offene Spiele – die Tabelle aktualisiert sich sofort. Fokusverein
        ist hervorgehoben.
      </p>
      <div className="matchday-list">
        {visibleDays.map((day) => (
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
                    <div className="fixture-teams">
                      <span>{match.team1.shortName || match.team1.teamName}</span>
                      <span className="vs">–</span>
                      <span>{match.team2.shortName || match.team2.teamName}</span>
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
      {days.length > visibleDays.length && (
        <p className="hint">
          Zeige die nächsten {visibleDays.length} von {days.length} Spieltagen. Weitere folgen,
          sobald frühere gesetzt oder gespielt sind.
        </p>
      )}
    </div>
  )
}
