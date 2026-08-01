import { useMemo, useState } from 'react'
import { defaultSeason, LEAGUES } from './api/openliga'
import { LeagueSwitcher } from './components/LeagueSwitcher'
import { ScenarioPanel } from './components/ScenarioPanel'
import { StandingsTable } from './components/StandingsTable'
import { TeamInsight } from './components/TeamInsight'
import { useLeagueData } from './hooks/useLeagueData'
import { computePositionRanges } from './lib/scenarios'
import {
  buildStandings,
  currentMatchday,
  matchdays,
  remainingMatches,
} from './lib/table'
import type { LeagueShortcut, ScenarioResult } from './types'
import './App.css'

function seasonOptions(base: number): number[] {
  return [base, base - 1, base - 2, base - 3]
}

export default function App() {
  const baseSeason = defaultSeason()
  const [league, setLeague] = useState<LeagueShortcut>('bl1')
  const [season, setSeason] = useState(baseSeason)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([])
  const [asOfMatchday, setAsOfMatchday] = useState<number | null>(null)
  const [useCutoff, setUseCutoff] = useState(false)

  const { matches, loading, error, updatedAt, refreshing, reload } = useLeagueData(
    league,
    season,
  )

  const days = useMemo(() => matchdays(matches), [matches])
  const liveMatchday = useMemo(() => currentMatchday(matches), [matches])

  const cutoff = useCutoff ? (asOfMatchday ?? liveMatchday) : null

  const baseStandings = useMemo(
    () => buildStandings(matches, { maxMatchday: cutoff }),
    [matches, cutoff],
  )

  const openMatches = useMemo(
    () => remainingMatches(matches, cutoff),
    [matches, cutoff],
  )

  const projectedStandings = useMemo(
    () => buildStandings(matches, { maxMatchday: cutoff, scenarios }),
    [matches, cutoff, scenarios],
  )

  const ranges = useMemo(
    () => computePositionRanges(baseStandings, openMatches),
    [baseStandings, openMatches],
  )

  const selectedTeam =
    projectedStandings.find((s) => s.teamId === selectedTeamId) ??
    baseStandings.find((s) => s.teamId === selectedTeamId) ??
    null

  const selectedRange = ranges.find((r) => r.teamId === selectedTeamId) ?? null
  const leagueLabel = LEAGUES.find((l) => l.shortcut === league)?.label ?? league

  const onLeagueChange = (next: LeagueShortcut) => {
    setLeague(next)
    setSelectedTeamId(null)
    setScenarios([])
    setUseCutoff(false)
    setAsOfMatchday(null)
  }

  const onSeasonChange = (next: number) => {
    setSeason(next)
    setSelectedTeamId(null)
    setScenarios([])
    setUseCutoff(false)
    setAsOfMatchday(null)
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-copy">
          <p className="brand">Tabellenblick</p>
          <h1>
            Echtzeit-Analyse
            <br />
            {leagueLabel}
          </h1>
          <p className="lead">
            Tabellenkonstellationen, Restprogramm und mögliche Endplätze – live aus
            OpenLigaDB.
          </p>
        </div>
        <div className="hero-meta">
          <LeagueSwitcher
            league={league}
            season={season}
            seasons={seasonOptions(baseSeason)}
            onLeagueChange={onLeagueChange}
            onSeasonChange={onSeasonChange}
          />
          <div className="status-row">
            <span className={`pulse ${refreshing ? 'on' : ''}`} aria-hidden />
            <span>
              {updatedAt
                ? `Aktualisiert ${updatedAt.toLocaleTimeString('de-DE')}`
                : 'Lade…'}
            </span>
            <button type="button" className="ghost" onClick={() => void reload()}>
              Neu laden
            </button>
          </div>
        </div>
      </header>

      <section className="toolbar">
        <label className="toggle">
          <input
            type="checkbox"
            checked={useCutoff}
            onChange={(e) => {
              setUseCutoff(e.target.checked)
              if (e.target.checked && asOfMatchday == null) {
                setAsOfMatchday(Math.max(1, liveMatchday - 1))
              }
              setScenarios([])
            }}
          />
          Stand nach Spieltag
        </label>
        {useCutoff && (
          <label className="cutoff">
            Spieltag
            <input
              type="number"
              min={0}
              max={days[days.length - 1] ?? 34}
              value={asOfMatchday ?? 0}
              onChange={(e) => {
                setAsOfMatchday(Number(e.target.value))
                setScenarios([])
              }}
            />
          </label>
        )}
        <span className="toolbar-note">
          {openMatches.length} offene Spiele
          {scenarios.length > 0 ? ` · ${scenarios.length} Szenarien gesetzt` : ''}
        </span>
      </section>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      {loading && matches.length === 0 ? (
        <div className="banner">Lade Ligadaten…</div>
      ) : (
        <main className="layout">
          <div className="main-col">
            <StandingsTable
              standings={projectedStandings}
              ranges={ranges}
              selectedTeamId={selectedTeamId}
              onSelectTeam={setSelectedTeamId}
              highlightScenarios={scenarios.length > 0}
            />
          </div>
          <aside className="side-col">
            <TeamInsight
              team={selectedTeam}
              range={selectedRange}
              remainingCount={
                openMatches.filter(
                  (m) =>
                    selectedTeamId != null &&
                    (m.team1.teamId === selectedTeamId ||
                      m.team2.teamId === selectedTeamId),
                ).length
              }
            />
            <ScenarioPanel
              matches={openMatches}
              scenarios={scenarios}
              onChange={setScenarios}
              focusTeamId={selectedTeamId}
            />
          </aside>
        </main>
      )}

      <footer className="footer">
        Daten: OpenLigaDB · Aktualisierung alle 60 Sekunden · Keine Wettberatung
      </footer>
    </div>
  )
}
