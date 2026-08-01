import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultSeason } from './api/dataSource'
import { LeagueSwitcher } from './components/LeagueSwitcher'
import { ScenarioPanel } from './components/ScenarioPanel'
import { StandingsTable } from './components/StandingsTable'
import { TeamInsight } from './components/TeamInsight'
import { ZoneLegend } from './components/ZoneLegend'
import { getLeague, type LeagueId } from './leagues'
import { useLeagueData } from './hooks/useLeagueData'
import { computeNextMatchdayOutlook, computePositionRanges, computeSeasonOutlook } from './lib/scenarios'
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
  const [leagueId, setLeagueId] = useState<LeagueId>('bl1')
  const [season, setSeason] = useState(baseSeason)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([])
  const [asOfMatchday, setAsOfMatchday] = useState<number | null>(null)
  const [useCutoff, setUseCutoff] = useState(false)
  const autoCutoffKey = useRef<string | null>(null)

  const { matches, league, loading, error, updatedAt, refreshing, reload } = useLeagueData(
    leagueId,
    season,
  )

  const meta = league ?? getLeague(leagueId)
  const leagueLabel = meta?.label ?? leagueId

  const days = useMemo(() => matchdays(matches), [matches])
  const liveMatchday = useMemo(() => currentMatchday(matches), [matches])
  const maxDay = days[days.length - 1] ?? 34
  const cutoff = useCutoff ? (asOfMatchday ?? liveMatchday) : null

  const finishedCount = useMemo(
    () => matches.filter((m) => m.matchIsFinished).length,
    [matches],
  )
  const seasonComplete = matches.length > 0 && finishedCount === matches.length

  // Abgeschlossene Saison: automatisch Stand vor dem letzten Spieltag,
  // damit „Nächster Spieltag“ sofort eine Spanne hat.
  useEffect(() => {
    const key = `${leagueId}-${season}`
    if (!matches.length || autoCutoffKey.current === key) return
    if (seasonComplete) {
      setUseCutoff(true)
      setAsOfMatchday(Math.max(0, maxDay - 1))
      setScenarios([])
    }
    autoCutoffKey.current = key
  }, [matches, leagueId, season, seasonComplete, maxDay])

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

  const nextMatchdayOutlook = useMemo(() => {
    if (selectedTeamId == null) return null
    return computeNextMatchdayOutlook(baseStandings, openMatches, selectedTeamId)
  }, [baseStandings, openMatches, selectedTeamId])

  const seasonOutlook = useMemo(() => {
    if (selectedTeamId == null) return null
    return computeSeasonOutlook(baseStandings, openMatches, selectedTeamId)
  }, [baseStandings, openMatches, selectedTeamId])

  const leaderPoints = projectedStandings[0]?.points ?? 0
  const relegLine = projectedStandings.find((s) => s.rank === 16)?.points ?? 0
  const seasonProgress =
    matches.length > 0 ? Math.round((finishedCount / matches.length) * 100) : 0

  const suggestedCutoff =
    seasonComplete || openMatches.length === 0 ? Math.max(0, maxDay - 1) : null

  const onLeagueChange = (next: LeagueId) => {
    setLeagueId(next)
    setSelectedTeamId(null)
    setScenarios([])
    setUseCutoff(false)
    setAsOfMatchday(null)
    autoCutoffKey.current = null
  }

  const onSeasonChange = (next: number) => {
    setSeason(next)
    setSelectedTeamId(null)
    setScenarios([])
    setUseCutoff(false)
    setAsOfMatchday(null)
    autoCutoffKey.current = null
  }

  const enableMatchdayCutoff = (day: number) => {
    setUseCutoff(true)
    setAsOfMatchday(day)
    setScenarios([])
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-copy">
          <p className="brand">Tabellenblick</p>
          <h1>
            {leagueLabel}
            <br />
            <span className="hero-sub">Tabellen-Szenarien</span>
          </h1>
          <p className="lead">
            Wo landet dein Verein noch? Restprogramm setzen, Tabelle live aus OpenLigaDB.
          </p>
        </div>
        <div className="hero-meta">
          <LeagueSwitcher
            leagueId={leagueId}
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
              {matches.length > 0 ? ` · Saison ${seasonProgress}%` : ''}
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
                const suggest = Math.max(0, Math.min(liveMatchday - 1, maxDay))
                setAsOfMatchday(suggest)
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
              type="range"
              min={0}
              max={maxDay}
              value={asOfMatchday ?? 0}
              onChange={(e) => {
                setAsOfMatchday(Number(e.target.value))
                setScenarios([])
              }}
            />
            <strong className="cutoff-value">{asOfMatchday ?? 0}</strong>
          </label>
        )}
        <span className="toolbar-note">
          {openMatches.length} offene Spiele
          {scenarios.length > 0 ? ` · ${scenarios.length} Szenarien` : ''}
          {!useCutoff && liveMatchday ? ` · Spieltag ${liveMatchday}` : ''}
          {useCutoff && nextMatchdayOutlook
            ? ` · Analyse → ST ${nextMatchdayOutlook.matchday}`
            : ''}
        </span>
      </section>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      {loading && matches.length === 0 && !error ? (
        <div className="banner">Lade Ligadaten…</div>
      ) : matches.length === 0 && !loading ? (
        <div className="banner">Keine Spieldaten für diese Saison.</div>
      ) : (
        <main className="layout">
          <div className="main-col">
            <ZoneLegend league={leagueId} />
            <StandingsTable
              standings={projectedStandings}
              baseline={scenarios.length > 0 ? baseStandings : null}
              ranges={ranges}
              selectedTeamId={selectedTeamId}
              onSelectTeam={setSelectedTeamId}
              highlightScenarios={scenarios.length > 0}
              league={leagueId}
            />
          </div>
          <aside className="side-col">
            <TeamInsight
              team={selectedTeam}
              seasonOutlook={seasonOutlook}
              nextMatchday={nextMatchdayOutlook}
              league={leagueId}
              suggestedCutoff={suggestedCutoff}
              onEnableMatchdayCutoff={enableMatchdayCutoff}
              pointsToFirst={
                selectedTeam ? leaderPoints - selectedTeam.points : null
              }
              pointsAboveRelegation={
                selectedTeam ? selectedTeam.points - relegLine : null
              }
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
        Daten: OpenLigaDB · Aktualisierung alle 60 Sekunden · Keine Wettberatung · Build{' '}
        <code>{__APP_BUILD__}</code>
      </footer>
    </div>
  )
}
