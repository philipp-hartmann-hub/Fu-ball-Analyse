import type { LeagueZoneId } from '../lib/table'
import type { PositionRange, StandingRow } from '../types'
import {
  primaryForecastZone,
  type TeamForecast,
} from '../lib/simulation'
import {
  formatExpectedRemainingPoints,
  hardnessGradeLabel,
  type ScheduleHardness,
} from '../lib/schedule'
import { NOT_ENOUGH_DATA_LABEL } from '../lib/reliability'
import { zoneForRank } from '../lib/table'
import type { ExplainTopic } from '../lib/modelExplanations'
import { ExplainLink } from './ExplainLink'

export type TableViewMode = 'range' | 'forecast'

interface Props {
  standings: StandingRow[]
  baseline?: StandingRow[] | null
  ranges: PositionRange[]
  forecasts?: TeamForecast[] | null
  forecastLoading?: boolean
  /** false = Stärken unverlässlich → keine Zonen-Prozente */
  forecastReliable?: boolean
  viewMode: TableViewMode
  selectedTeamId: number | null
  onSelectTeam: (teamId: number) => void
  highlightScenarios: boolean
  league: LeagueZoneId
  /** Restprogramm-Härte je Verein */
  hardnessByTeam?: Map<number, ScheduleHardness> | null
  onExplain?: (topic: ExplainTopic) => void
}

export function StandingsTable({
  standings,
  baseline,
  ranges,
  forecasts,
  forecastLoading,
  forecastReliable = true,
  viewMode,
  selectedTeamId,
  onSelectTeam,
  highlightScenarios,
  league,
  hardnessByTeam,
  onExplain,
}: Props) {
  const rangeMap = new Map(ranges.map((r) => [r.teamId, r]))
  const forecastMap = new Map((forecasts ?? []).map((f) => [f.teamId, f]))
  const baseRank = new Map((baseline ?? []).map((r) => [r.teamId, r.rank]))

  return (
    <div className="table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th className="num">#</th>
            <th className="delta col-delta" title="Veränderung zum Ist-Stand">
              Δ
            </th>
            <th className="team">Verein</th>
            <th className="num col-form">Sp</th>
            <th className="num col-form">S</th>
            <th className="num col-form">U</th>
            <th className="num col-form">N</th>
            <th className="num col-goals">Tore</th>
            <th className="num col-diff">Diff</th>
            <th className="num pts">Pkt</th>
            <th
              className="col-hardness"
              title="Erwartete Restpunkte aus dem Poisson-Modell (Vereinssicht)"
            >
              Restprog.
              {onExplain && (
                <span className="th-explain">
                  {' '}
                  <ExplainLink
                    topic="hardness"
                    onExplain={onExplain}
                    className="explain-inline"
                  >
                    ?
                  </ExplainLink>
                </span>
              )}
            </th>
            <th className="range">
              {viewMode === 'forecast' ? 'Prognose' : 'Möglich'}
              {onExplain && (
                <span className="th-explain">
                  {' '}
                  <ExplainLink
                    topic={viewMode === 'forecast' ? 'forecast' : 'span'}
                    onExplain={onExplain}
                    className="explain-inline"
                  >
                    ?
                  </ExplainLink>
                </span>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const range = rangeMap.get(row.teamId)
            const forecast = forecastMap.get(row.teamId)
            const zone = zoneForRank(row.rank, league)
            const selected = selectedTeamId === row.teamId
            const prev = baseRank.get(row.teamId)
            const delta = prev != null ? prev - row.rank : 0
            const hardness = hardnessByTeam?.get(row.teamId)
            return (
              <tr
                key={row.teamId}
                className={[
                  `zone-${zone}`,
                  selected ? 'selected' : '',
                  highlightScenarios ? 'scenario-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectTeam(row.teamId)}
              >
                <td className="num rank">{row.rank}</td>
                <td className="delta col-delta">
                  {delta > 0 ? (
                    <span className="up">↑{delta}</span>
                  ) : delta < 0 ? (
                    <span className="down">↓{-delta}</span>
                  ) : (
                    <span className="flat">·</span>
                  )}
                </td>
                <td className="team">
                  <span className="team-inner">
                    {row.teamIconUrl ? (
                      <img src={row.teamIconUrl} alt="" width={22} height={22} loading="lazy" />
                    ) : (
                      <span className="crest-fallback" aria-hidden />
                    )}
                    <span className="full">{row.teamName}</span>
                    <span className="short">{row.shortName || row.teamName}</span>
                  </span>
                </td>
                <td className="num col-form">{row.played}</td>
                <td className="num col-form">{row.won}</td>
                <td className="num col-form">{row.draw}</td>
                <td className="num col-form">{row.lost}</td>
                <td className="num col-goals">
                  {row.goalsFor}:{row.goalsAgainst}
                </td>
                <td className="num col-diff">
                  {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                </td>
                <td className="num pts">{row.points}</td>
                <td className="col-hardness">
                  {hardness && hardness.remainingGames > 0 ? (
                    <HardnessCell hardness={hardness} clubName={row.shortName || row.teamName} />
                  ) : (
                    <span className="hardness-empty">–</span>
                  )}
                </td>
                <td className="range">
                  {viewMode === 'forecast' ? (
                    forecastLoading && !forecast ? (
                      <span className="pill muted">…</span>
                    ) : !forecastReliable ? (
                      <span
                        className="pill muted forecast-pending"
                        title={NOT_ENOUGH_DATA_LABEL}
                      >
                        n/a
                      </span>
                    ) : forecast ? (
                      <ForecastCell forecast={forecast} league={league} />
                    ) : (
                      '–'
                    )
                  ) : range ? (
                    <span
                      className={`pill${range.bestRank === range.worstRank ? ' locked' : ''}`}
                      title={
                        range.mode === 'exact'
                          ? 'Genau berechnet – für diesen Verein sind nur noch wenige entscheidende Spiele offen.'
                          : 'Noch mögliche Plätze (sichere Obergrenze). Mit weiteren Ergebnissen kann der Bereich nur enger werden.'
                      }
                    >
                      {range.bestRank === range.worstRank
                        ? `${range.bestRank}.`
                        : `${range.bestRank}.–${range.worstRank}.`}
                      <span className={`range-mode mode-${range.mode}`}>
                        {range.mode === 'exact' ? 'exakt' : 'rechnerisch'}
                      </span>
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HardnessCell({
  hardness,
  clubName,
}: {
  hardness: ScheduleHardness
  clubName: string
}) {
  if (!hardness.reliable || !hardness.grade) {
    return (
      <span
        className="hardness-pill tone-pending"
        title={NOT_ENOUGH_DATA_LABEL}
      >
        –
      </span>
    )
  }
  const pts = formatExpectedRemainingPoints(hardness.expectedRemainingPoints)
  const gradeLabel = hardnessGradeLabel(hardness.grade)
  return (
    <span
      className={`hardness-pill tone-${hardness.grade}`}
      title={`Erwartete Restpunkte ${pts} · ${gradeLabel} für ${clubName} · Modellschätzung`}
    >
      <span className="hardness-pts">{pts}</span>
      <span className="hardness-grade-short">{gradeLabel}</span>
    </span>
  )
}

function ForecastCell({
  forecast,
  league,
}: {
  forecast: TeamForecast
  league: LeagueZoneId
}) {
  const { zone, probability } = primaryForecastZone(forecast, league)
  const pct = Math.round(probability * 100)

  return (
    <div
      className="forecast-cell"
      title={`Modellschätzung · Median-Rang ${forecast.medianRank}. · ~${forecast.expectedPoints.toFixed(1)} Pkt.`}
    >
      <div className="forecast-meta">
        <span className="forecast-label">{shortZoneLabel(zone, league)}</span>
        <span className="forecast-pct">{pct}%</span>
      </div>
      <div className="forecast-bar" aria-hidden>
        <span className={`forecast-fill zone-${zone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function shortZoneLabel(zone: string, league: LeagueZoneId): string {
  if (league === 'bl2' || league === 'bl3') {
    if (zone === 'champion') return 'Aufstieg'
    if (zone === 'cl') return 'Rel.↑'
    if (zone === 'relegation') return 'Rel.↓'
    if (zone === 'direct-relegation') return 'Abstieg'
    return 'Mittelfeld'
  }
  if (zone === 'champion') return 'Meister'
  if (zone === 'cl') return 'CL'
  if (zone === 'el') return 'EL'
  if (zone === 'ecl') return 'ECL'
  if (zone === 'relegation') return 'Relegation'
  if (zone === 'direct-relegation') return 'Abstieg'
  return 'Mittelfeld'
}
