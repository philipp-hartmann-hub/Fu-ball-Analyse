import { useMemo, useState } from 'react'
import { defaultSeason } from './api/dataSource'
import { LeagueSwitcher } from './components/LeagueSwitcher'
import { ScenarioPanel } from './components/ScenarioPanel'
import { StandingsTable } from './components/StandingsTable'
import { TeamInsight } from './components/TeamInsight'
import { getCompetition, hasFootballDataToken } from './competitions'
import { useLeagueData } from './hooks/useLeagueData'
import { computePositionRanges } from './lib/scenarios'
import {
  buildStandings,
  currentMatchday,
  matchdays,
  remainingMatches,
} from './lib/table'
import type { ScenarioResult } from './types'
import './App.css'

function seasonOptions(base: number): number[] {
  return [base, base - 1, base - 2, base - 3]
}

export default function App() {
  const baseSeason = defaultSeason()
  const [competitionId, setCompetitionId] = useState('bl1')
  const [season, setSeason] = useState(baseSeason)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([])
  const [asOfMatchday, setAsOfMatchday] = useState<number | null>(null)
  const [useCutoff, setUseCutoff] = useState(false)

  const { matches, competition, provider, loading, error, updatedAt, refreshing, reload } =
    useLeagueData(competitionId, season)

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

  const meta = competition ?? getCompetition(competitionId)
  const kind = meta?.kind ?? 'domestic'
  const leagueLabel = meta?.label ?? competitionId

  const onCompetitionChange = (next: string) => {
    setCompetitionId(next)
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
            Top-5-Ligen, UEFA-Wettbewerbe und Nations League – Tabellenkonstellationen und
            mögliche Endplätze.
          </p>
        </div>
        <div className="hero-meta">
          <LeagueSwitcher
            competitionId={competitionId}
            season={season}
            seasons={seasonOptions(baseSeason)}
            onCompetitionChange={onCompetitionChange}
            onSeasonChange={onSeasonChange}
          />
          <div className="status-row">
            <span className={`pulse ${refreshing ? 'on' : ''}`} aria-hidden />
            <span>
              {updatedAt
                ? `Aktualisiert ${updatedAt.toLocaleTimeString('de-DE')}`
                : 'Lade…'}
              {provider ? ` · ${provider}` : ''}
            </span>
            <button type="button" className="ghost" onClick={() => void reload()}>
              Neu laden
            </button>
          </div>
        </div>
      </header>

      {!hasFootballDataToken() && (
        <div className="banner warn">
          Ohne <code>VITE_FOOTBALL_DATA_TOKEN</code> laufen Bundesliga und Nations League über
          OpenLigaDB. Für Premier League, La Liga, Serie A, Ligue 1 sowie Champions-/Europa-/Conference
          League einen kostenlosen Token von{' '}
          <a href="https://www.football-data.org/client/register" target="_blank" rel="noreferrer">
            football-data.org
          </a>{' '}
          in <code>.env</code> eintragen.
        </div>
      )}

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
              max={days[days.length - 1] ?? 38}
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

      {loading && matches.length === 0 && !error ? (
        <div className="banner">Lade Wettbewerbsdaten…</div>
      ) : matches.length === 0 && !loading ? (
        <div className="banner">Keine Spieldaten für diese Saison gefunden.</div>
      ) : (
        <main className="layout">
          <div className="main-col">
            <StandingsTable
              standings={projectedStandings}
              ranges={ranges}
              selectedTeamId={selectedTeamId}
              onSelectTeam={setSelectedTeamId}
              highlightScenarios={scenarios.length > 0}
              kind={kind}
            />
          </div>
          <aside className="side-col">
            <TeamInsight
              team={selectedTeam}
              range={selectedRange}
              kind={kind}
              leagueSize={projectedStandings.length}
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
        Daten: OpenLigaDB / football-data.org · Aktualisierung alle 60 Sekunden · Keine
        Wettberatung
      </footer>
    </div>
  )
}
