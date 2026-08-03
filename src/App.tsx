import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultSeason } from './api/dataSource'
import { LeagueSwitcher } from './components/LeagueSwitcher'
import { ExplainModal } from './components/ExplainModal'
import { ExplainLink } from './components/ExplainLink'
import { ScenarioPanel } from './components/ScenarioPanel'
import { StandingsTable, type TableViewMode } from './components/StandingsTable'
import { TeamInsight } from './components/TeamInsight'
import { TeamCompare } from './components/TeamCompare'
import { LiveMatchesBar } from './components/LiveMatchesBar'
import { ZoneLegend } from './components/ZoneLegend'
import type { ExplainTopic } from './lib/modelExplanations'
import {
  liveMatchesToScenarios,
  mergeScenarios,
} from './lib/live'
import { getLeague, type LeagueId } from './leagues'
import { useLeagueData } from './hooks/useLeagueData'
import { useSeasonForecast } from './hooks/useSeasonForecast'
import {
  computeNextMatchdayOutlook,
  computePositionRanges,
  computeSeasonOutlook,
  computeTargetMatchdayOutlook,
  computeTargetSeasonOutlook,
  enumerateMatchdayOutcomes,
  scenariosFromConditions,
  seasonExtremeOutcomes,
} from './lib/scenarios'
import { collectTargetPointsSamples } from './lib/simulation'
import { deriveThresholdLines } from './lib/thresholds'
import { computeScheduleHardness } from './lib/schedule'
import {
  encodeShareState,
  loadShareStateFromSearch,
  replaceShareQuery,
  shouldPersistShare,
  type ShareState,
} from './lib/shareState'
import {
  buildStandings,
  currentMatchday,
  matchdays,
  relegationCutoffRank,
  remainingMatches,
  resolveMatchScores,
} from './lib/table'
import type { ScenarioResult, TargetComparator } from './types'
import './App.css'

function seasonOptions(base: number): number[] {
  return [base, base - 1, base - 2, base - 3]
}

function bootShare(): ShareState | null {
  if (typeof window === 'undefined') return null
  return loadShareStateFromSearch(window.location.search)
}

export default function App() {
  const baseSeason = defaultSeason()
  const initialShare = useMemo(() => bootShare(), [])
  const skipAutoCutoffWipe = useRef(initialShare != null)

  const [leagueId, setLeagueId] = useState<LeagueId>(
    () => initialShare?.leagueId ?? 'bl1',
  )
  const [season, setSeason] = useState(() => initialShare?.season ?? baseSeason)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [matchdayTargetRank, setMatchdayTargetRank] = useState(4)
  const [matchdayTargetComparator, setMatchdayTargetComparator] =
    useState<TargetComparator>('atLeast')
  const [seasonTargetRank, setSeasonTargetRank] = useState(4)
  const [seasonTargetComparator, setSeasonTargetComparator] =
    useState<TargetComparator>('atLeast')
  const [scenarios, setScenarios] = useState<ScenarioResult[]>(
    () => initialShare?.scenarios ?? [],
  )
  const [asOfMatchday, setAsOfMatchday] = useState<number | null>(
    () => initialShare?.asOfMatchday ?? null,
  )
  const [useCutoff, setUseCutoff] = useState(() => initialShare?.useCutoff ?? false)
  const [shareHint, setShareHint] = useState<string | null>(null)
  const [tableView, setTableView] = useState<TableViewMode>('range')
  const [showHardness, setShowHardness] = useState(false)
  const [explainTopic, setExplainTopic] = useState<ExplainTopic | null>(null)
  const [sideTab, setSideTab] = useState<
    'club' | 'results' | 'scenario' | 'compare'
  >('club')
  const [compareA, setCompareA] = useState<number | null>(null)
  const [compareB, setCompareB] = useState<number | null>(null)
  const [includeLiveInTable, setIncludeLiveInTable] = useState(false)

  const openExplain = (topic: ExplainTopic) => setExplainTopic(topic)
  const autoCutoffKey = useRef<string | null>(null)
  const shareHintTimer = useRef<number | null>(null)

  const {
    matches,
    league,
    loading,
    error,
    updatedAt,
    refreshing,
    reload,
    liveMatches,
    pollMs,
  } = useLeagueData(leagueId, season)

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
  // Share-Links: ersten Auto-Wipe überspringen, damit ?s=-Szenarien erhalten bleiben.
  useEffect(() => {
    const key = `${leagueId}-${season}`
    if (!matches.length || autoCutoffKey.current === key) return
    if (seasonComplete) {
      if (skipAutoCutoffWipe.current) {
        skipAutoCutoffWipe.current = false
        if (!useCutoff) {
          setUseCutoff(true)
          setAsOfMatchday((prev) => prev ?? Math.max(0, maxDay - 1))
        }
      } else {
        setUseCutoff(true)
        setAsOfMatchday(Math.max(0, maxDay - 1))
        setScenarios([])
      }
    } else {
      skipAutoCutoffWipe.current = false
    }
    autoCutoffKey.current = key
  }, [matches, leagueId, season, seasonComplete, maxDay, useCutoff])

  // Szenarien + Kontext → ?s= (replaceState, kein Reload)
  useEffect(() => {
    const state: ShareState = {
      leagueId,
      season,
      useCutoff,
      asOfMatchday: useCutoff ? asOfMatchday : null,
      scenarios,
    }
    replaceShareQuery(shouldPersistShare(state) ? encodeShareState(state) : null)
  }, [leagueId, season, useCutoff, asOfMatchday, scenarios])

  const liveScenarios = useMemo(
    () => (includeLiveInTable ? liveMatchesToScenarios(liveMatches) : []),
    [includeLiveInTable, liveMatches],
  )
  const liveMatchIds = useMemo(
    () => new Set(liveMatches.map((l) => l.match.matchID)),
    [liveMatches],
  )
  const tableScenarios = useMemo(
    () => mergeScenarios(liveScenarios, scenarios),
    [liveScenarios, scenarios],
  )

  const baseStandings = useMemo(
    () =>
      buildStandings(matches, {
        maxMatchday: cutoff,
        scenarios: liveScenarios,
      }),
    [matches, cutoff, liveScenarios],
  )
  const openMatches = useMemo(() => {
    const open = remainingMatches(matches, cutoff)
    if (!includeLiveInTable || liveMatchIds.size === 0) return open
    // Live-Stände sind schon in der Tabelle → nicht nochmal als Restprogramm zählen
    return open.filter((m) => !liveMatchIds.has(m.matchID))
  }, [matches, cutoff, includeLiveInTable, liveMatchIds])
  const playedScores = useMemo(
    () =>
      resolveMatchScores(matches, {
        maxMatchday: cutoff,
        scenarios: liveScenarios,
      }),
    [matches, cutoff, liveScenarios],
  )
  const projectedStandings = useMemo(
    () =>
      buildStandings(matches, {
        maxMatchday: cutoff,
        scenarios: tableScenarios,
      }),
    [matches, cutoff, tableScenarios],
  )
  const ranges = useMemo(
    () => computePositionRanges(baseStandings, openMatches, playedScores),
    [baseStandings, openMatches, playedScores],
  )

  const scheduleHardness = useMemo(
    () => computeScheduleHardness(openMatches, baseStandings),
    [openMatches, baseStandings],
  )
  const hardnessByTeam = useMemo(
    () => new Map(scheduleHardness.map((h) => [h.teamId, h])),
    [scheduleHardness],
  )

  const {
    result: forecastResult,
    loading: forecastLoading,
    error: forecastError,
  } = useSeasonForecast({
    enabled:
      (tableView === 'forecast' || selectedTeamId != null) &&
      baseStandings.length > 0,
    baseStandings,
    remaining: openMatches,
    league: leagueId,
    fixedScenarios: tableScenarios,
    playedScores,
    collectPointsByRank: selectedTeamId != null,
  })

  const selectedTeam =
    projectedStandings.find((s) => s.teamId === selectedTeamId) ??
    baseStandings.find((s) => s.teamId === selectedTeamId) ??
    null

  const nextMatchdayOutlook = useMemo(() => {
    if (selectedTeamId == null) return null
    return computeNextMatchdayOutlook(
      baseStandings,
      openMatches,
      selectedTeamId,
      playedScores,
    )
  }, [baseStandings, openMatches, selectedTeamId, playedScores])

  const seasonOutlook = useMemo(() => {
    if (selectedTeamId == null) return null
    return computeSeasonOutlook(
      baseStandings,
      openMatches,
      selectedTeamId,
      playedScores,
    )
  }, [baseStandings, openMatches, selectedTeamId, playedScores])

  const clampedMatchdayTarget = useMemo(() => {
    const n = Math.max(1, baseStandings.length)
    return Math.max(1, Math.min(n, matchdayTargetRank))
  }, [baseStandings.length, matchdayTargetRank])

  const clampedSeasonTarget = useMemo(() => {
    const n = Math.max(1, baseStandings.length)
    return Math.max(1, Math.min(n, seasonTargetRank))
  }, [baseStandings.length, seasonTargetRank])

  useEffect(() => {
    const n = baseStandings.length
    if (n <= 0) return
    if (matchdayTargetRank > n) setMatchdayTargetRank(n)
    if (seasonTargetRank > n) setSeasonTargetRank(n)
  }, [baseStandings.length, matchdayTargetRank, seasonTargetRank])

  const matchdayTargetOutlook = useMemo(() => {
    if (selectedTeamId == null) return null
    return computeTargetMatchdayOutlook(
      baseStandings,
      openMatches,
      selectedTeamId,
      clampedMatchdayTarget,
      matchdayTargetComparator,
      playedScores,
    )
  }, [
    baseStandings,
    openMatches,
    selectedTeamId,
    clampedMatchdayTarget,
    matchdayTargetComparator,
    playedScores,
  ])

  const seasonTargetOutlook = useMemo(() => {
    if (selectedTeamId == null) return null
    const teamForecast = forecastResult?.teams.find(
      (t) => t.teamId === selectedTeamId,
    )
    const forecast =
      forecastResult && teamForecast
        ? {
            runs: forecastResult.runs,
            rankCounts: teamForecast.rankCounts,
            targetPointsSamples: collectTargetPointsSamples(
              teamForecast,
              clampedSeasonTarget,
              seasonTargetComparator,
            ),
          }
        : null
    return computeTargetSeasonOutlook(
      baseStandings,
      openMatches,
      selectedTeamId,
      clampedSeasonTarget,
      seasonTargetComparator,
      playedScores,
      forecast,
    )
  }, [
    baseStandings,
    openMatches,
    selectedTeamId,
    clampedSeasonTarget,
    seasonTargetComparator,
    playedScores,
    forecastResult,
  ])

  const matchdayThresholds = useMemo(() => {
    if (!selectedTeam) return []
    const outcomes = enumerateMatchdayOutcomes(
      baseStandings,
      openMatches,
      selectedTeam.teamId,
      playedScores,
    )
    if (!outcomes) return []
    const playsNext = nextMatchdayOutlook?.plays ?? false
    const reachableMax = selectedTeam.points + (playsNext ? 3 : 0)
    return deriveThresholdLines(
      outcomes,
      selectedTeam.points,
      selectedTeam.rank,
      leagueId,
      {
        exact: (nextMatchdayOutlook?.fixtureCount ?? 99) <= 12,
        reachableMax,
        horizon: 'matchday',
      },
    )
  }, [
    selectedTeam,
    baseStandings,
    openMatches,
    playedScores,
    nextMatchdayOutlook?.fixtureCount,
    nextMatchdayOutlook?.plays,
    leagueId,
  ])

  const seasonThresholds = useMemo(() => {
    if (!selectedTeam) return []
    const outcomes = seasonExtremeOutcomes(
      baseStandings,
      openMatches,
      selectedTeam.teamId,
      playedScores,
    )
    if (!outcomes) return []
    return deriveThresholdLines(
      outcomes,
      selectedTeam.points,
      selectedTeam.rank,
      leagueId,
      { exact: false, horizon: 'season' },
    )
  }, [selectedTeam, baseStandings, openMatches, playedScores, leagueId])

  const leaderPoints = projectedStandings[0]?.points ?? 0
  const relegCutoff = relegationCutoffRank(leagueId)
  const relegLine =
    projectedStandings.find((s) => s.rank === relegCutoff)?.points ?? 0
  const seasonProgress =
    matches.length > 0 ? Math.round((finishedCount / matches.length) * 100) : 0

  const suggestedCutoff =
    seasonComplete || openMatches.length === 0 ? Math.max(0, maxDay - 1) : null

  const flashShareHint = (message: string) => {
    setShareHint(message)
    if (shareHintTimer.current != null) window.clearTimeout(shareHintTimer.current)
    shareHintTimer.current = window.setTimeout(() => setShareHint(null), 2000)
  }

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

  const resetScenariosAndShare = () => {
    setScenarios([])
    replaceShareQuery(null)
    flashShareHint('Szenarien zurückgesetzt')
  }

  const copyShareLink = async () => {
    const state: ShareState = {
      leagueId,
      season,
      useCutoff,
      asOfMatchday: useCutoff ? asOfMatchday : null,
      scenarios,
    }
    const url = shouldPersistShare(state)
      ? replaceShareQuery(encodeShareState(state))
      : replaceShareQuery(null)
    try {
      await navigator.clipboard.writeText(url)
      flashShareHint('Link kopiert')
    } catch {
      flashShareHint('Kopieren fehlgeschlagen')
    }
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
              {refreshing
                ? 'Aktualisiere…'
                : updatedAt
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
        <div className="toolbar-actions">
          <button type="button" className="ghost" onClick={() => void copyShareLink()}>
            Link teilen
          </button>
          <button
            type="button"
            className="ghost"
            onClick={resetScenariosAndShare}
            disabled={scenarios.length === 0}
          >
            Zurücksetzen
          </button>
          {shareHint && <span className="share-hint">{shareHint}</span>}
        </div>
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
            <div className="table-toolbar">
              <ZoneLegend league={leagueId} />
              <div className="table-toolbar-controls">
                {liveMatches.length > 0 && (
                  <label className="hardness-toggle" title="Zwischenstände wie Szenarien in die Tabelle übernehmen">
                    <input
                      type="checkbox"
                      checked={includeLiveInTable}
                      onChange={(e) => setIncludeLiveInTable(e.target.checked)}
                    />
                    Live-Stände einrechnen
                  </label>
                )}
                <label className="hardness-toggle">
                  <input
                    type="checkbox"
                    checked={showHardness}
                    onChange={(e) => setShowHardness(e.target.checked)}
                  />
                  Restprogramm
                </label>
                <div className="table-view-toggle" role="tablist" aria-label="Tabellenansicht">
                  <button
                    type="button"
                    role="tab"
                    className={tableView === 'range' ? 'active' : ''}
                    aria-selected={tableView === 'range'}
                    onClick={() => setTableView('range')}
                  >
                    Spanne
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={tableView === 'forecast' ? 'active' : ''}
                    aria-selected={tableView === 'forecast'}
                    onClick={() => setTableView('forecast')}
                  >
                    Prognose
                  </button>
                </div>
              </div>
            </div>
            {tableView === 'forecast' ? (
              <p className="forecast-disclaimer">
                {forecastLoading
                  ? 'Simuliere Restprogramm…'
                  : forecastError
                    ? `Prognose nicht verfügbar: ${forecastError}`
                    : (
                      <>
                        Modellschätzung (Poisson-Simulation) – keine Vorhersage.{' '}
                        <ExplainLink topic="forecast" onExplain={openExplain} />
                      </>
                    )}
              </p>
            ) : (
              <p className="forecast-disclaimer">
                Rechnerische Best-/Schlechtfall-Spanne – keine Wahrscheinlichkeiten.{' '}
                <ExplainLink topic="span" onExplain={openExplain} />
              </p>
            )}
            {showHardness && (
              <p className="forecast-disclaimer">
                Restprogramm-Härte aus Gegner-PPG (Heim/Auswärts gewichtet).{' '}
                <ExplainLink topic="hardness" onExplain={openExplain} />
              </p>
            )}
            <StandingsTable
              standings={projectedStandings}
              baseline={scenarios.length > 0 ? baseStandings : null}
              ranges={ranges}
              forecasts={forecastResult?.teams ?? null}
              forecastLoading={forecastLoading}
              viewMode={tableView}
              selectedTeamId={selectedTeamId}
              onSelectTeam={setSelectedTeamId}
              highlightScenarios={scenarios.length > 0}
              league={leagueId}
              hardnessByTeam={hardnessByTeam}
              showHardness={showHardness}
              onExplain={openExplain}
            />
          </div>
          <aside className="side-col">
            <div className="side-tabs" role="tablist" aria-label="Seitenleiste">
              {(
                [
                  { id: 'club', label: 'Verein' },
                  { id: 'results', label: 'Ergebnisse' },
                  { id: 'scenario', label: 'Szenario' },
                  { id: 'compare', label: 'Vergleich' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={sideTab === tab.id ? 'active' : ''}
                  aria-selected={sideTab === tab.id}
                  onClick={() => {
                    setSideTab(tab.id)
                    if (tab.id === 'compare' && compareA == null && selectedTeamId != null) {
                      setCompareA(selectedTeamId)
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {sideTab === 'results' ? (
              <LiveMatchesBar
                matches={matches}
                pollMs={pollMs}
                refreshing={refreshing}
                liveCount={liveMatches.length}
                variant="panel"
              />
            ) : sideTab === 'scenario' ? (
              <ScenarioPanel
                matches={openMatches}
                scenarios={scenarios}
                onChange={setScenarios}
                focusTeamId={selectedTeamId}
              />
            ) : sideTab === 'compare' ? (
              <TeamCompare
                standings={projectedStandings}
                remaining={openMatches}
                hardnessByTeam={hardnessByTeam}
                teamAId={compareA}
                teamBId={compareB}
                onChangeTeamA={setCompareA}
                onChangeTeamB={setCompareB}
                onExplain={openExplain}
              />
            ) : (
              <TeamInsight
                team={selectedTeam}
                seasonOutlook={seasonOutlook}
                nextMatchday={nextMatchdayOutlook}
                matchdayTargetOutlook={matchdayTargetOutlook}
                seasonTargetOutlook={seasonTargetOutlook}
                matchdayTargetRank={clampedMatchdayTarget}
                matchdayTargetComparator={matchdayTargetComparator}
                seasonTargetRank={clampedSeasonTarget}
                seasonTargetComparator={seasonTargetComparator}
                onMatchdayTargetRankChange={setMatchdayTargetRank}
                onMatchdayTargetComparatorChange={setMatchdayTargetComparator}
                onSeasonTargetRankChange={setSeasonTargetRank}
                onSeasonTargetComparatorChange={setSeasonTargetComparator}
                league={leagueId}
                suggestedCutoff={suggestedCutoff}
                onEnableMatchdayCutoff={enableMatchdayCutoff}
                matchdayThresholds={matchdayThresholds}
                seasonThresholds={seasonThresholds}
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
                scheduleHardness={
                  selectedTeamId != null
                    ? (hardnessByTeam.get(selectedTeamId) ?? null)
                    : null
                }
                leagueTeamCount={baseStandings.length}
                onExplain={openExplain}
                onApplyConditions={(cond) => {
                  const added = scenariosFromConditions(cond)
                  setScenarios((prev) => {
                    const map = new Map(prev.map((s) => [s.matchId, s]))
                    for (const s of added) map.set(s.matchId, s)
                    return [...map.values()]
                  })
                  setSideTab('scenario')
                }}
              />
            )}
          </aside>
        </main>
      )}

      <footer className="footer">
        Daten: OpenLigaDB · Aktualisierung alle 60 Sekunden · Keine Wettberatung · Build{' '}
        <code>{__APP_BUILD__}</code>
      </footer>

      <ExplainModal topic={explainTopic} onClose={() => setExplainTopic(null)} />
    </div>
  )
}
