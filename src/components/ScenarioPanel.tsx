import { useState } from 'react'
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

export function ScenarioPanel({ matches, scenarios, onChange, focusTeamId }: Props) {
  const [onlyFocus, setOnlyFocus] = useState(false)
  const [mode, setMode] = useState<DetailMode>('grob')
  const map = new Map(scenarios.map((s) => [s.matchId, s]))

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
    // Bestehendes Feinergebnis behalten, wenn es zur Grob-Wahl passt
    if (existing && outcomeOf(existing) === outcome) {
      return
    }
    upsert(scenarioFromOutcome(matchId, outcome), matchId)
  }

  const setFine = (matchId: number, homeGoals: number, awayGoals: number) => {
    upsert(scenarioFromScore(matchId, homeGoals, awayGoals), matchId)
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
          ? 'Sieg Verein 1, Sieg Verein 2 oder Unentschieden.'
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

      <div className="matchday-list">
        {days.map((day) => (
          <section key={day} className="matchday-block">
            <h3>{day}. Spieltag</h3>
            <ul className="fixture-list">
              {(byMatchday.get(day) ?? []).map((match) => {
                const scenario = map.get(match.matchID)
                const current = outcomeOf(scenario)
                const involvesFocus =
                  focusTeamId != null &&
                  (match.team1.teamId === focusTeamId ||
                    match.team2.teamId === focusTeamId)
                const homeGoals = scenario?.homeGoals ?? 0
                const awayGoals = scenario?.awayGoals ?? 0

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

                    {mode === 'grob' ? (
                      <div className="outcome-btns coarse" role="group" aria-label="Grob-Ergebnis">
                        {(
                          [
                            {
                              key: 'home' as const,
                              label: `Sieg ${match.team1.shortName || match.team1.teamName}`,
                            },
                            {
                              key: 'away' as const,
                              label: `Sieg ${match.team2.shortName || match.team2.teamName}`,
                            },
                            { key: 'draw' as const, label: 'Unentschieden' },
                          ] as const
                        ).map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            title={label}
                            className={current === key ? 'active' : ''}
                            onClick={() =>
                              setCoarse(match.matchID, current === key ? null : key)
                            }
                          >
                            {label}
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
          </section>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="hint">Kein Restspiel für den gewählten Verein – anderen Verein wählen.</p>
      )}
    </div>
  )
}
