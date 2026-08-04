import type { LeagueZoneId } from '../lib/table'
import type { PositionRange, StandingRow } from '../types'
import {
  primaryForecastZone,
  type TeamForecast,
} from '../lib/simulation'
import {
  hardnessTone,
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
  /** Restprogramm-Härte je Verein; Spalte nur wenn showHardness */
  hardnessByTeam?: Map<number, ScheduleHardness> | null
  showHardness?: boolean
  /** Heuristik-Spanne: UI als innere Näherung („mindestens“) kennzeichnen */
  rangesApproximate?: boolean
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
  showHardness = false,
  rangesApproximate = false,
  onExplain,
}: Props) {
  const rangeMap = new Map(ranges.map((r) => [r.teamId, r]))
  const forecastMap = new Map((forecasts ?? []).map((f) => [f.teamId, f]))
  const baseRank = new Map((baseline ?? []).map((r) => [r.teamId, r.rank]))
  const teamCount = standings.length

  return (
    <div className="table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th className="num">#</th>
            <th className="delta" title="Veränderung zum Ist-Stand">
              Δ
            </th>
            <th>Verein</th>
            <th className="num col-form">Sp</th>
            <th className="num col-form">S</th>
            <th className="num col-form">U</th>
            <th className="num col-form">N</th>
            <th className="num">Tore</th>
            <th className="num">Diff</th>
            <th className="num">Pkt</th>
            {showHardness && (
              <th
                className="num col-hardness"
                title="Restprogramm-Härte: 0–100 (höher = schwerer), Rang in der Liga"
              >
                Härte
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
            )}
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
                <td className="delta">
                  {delta > 0 ? (
                    <span className="up">↑{delta}</span>
                  ) : delta < 0 ? (
                    <span className="down">↓{-delta}</span>
                  ) : (
                    <span className="flat">·</span>
                  )}
                </td>
                <td className="team">
                  {row.teamIconUrl ? (
                    <img src={row.teamIconUrl} alt="" width={22} height={22} loading="lazy" />
                  ) : (
                    <span className="crest-fallback" aria-hidden />
                  )}
                  <span className="full">{row.teamName}</span>
                  <span className="short">{row.shortName || row.teamName}</span>
                </td>
                <td className="num col-form">{row.played}</td>
                <td className="num col-form">{row.won}</td>
                <td className="num col-form">{row.draw}</td>
                <td className="num col-form">{row.lost}</td>
                <td className="num">
                  {row.goalsFor}:{row.goalsAgainst}
                </td>
                <td className="num">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                <td className="num pts">{row.points}</td>
                {showHardness && (
                  <td className="num col-hardness">
                    {hardness && hardness.remainingGames > 0 ? (
                      <HardnessCell hardness={hardness} teamCount={teamCount} />
                    ) : (
                      <span className="hardness-empty">–</span>
                    )}
                  </td>
                )}
                <td className="range">
                  {viewMode === 'forecast' ? (
                    forecastLoading && !forecast ? (
                      <span className="pill muted">…</span>
                    ) : !forecastReliable ? (
                      <span
                        className="pill muted forecast-pending"
                        title={NOT_ENOUGH_DATA_LABEL}
                      >
                        {NOT_ENOUGH_DATA_LABEL}
                      </span>
                    ) : forecast ? (
                      <ForecastCell forecast={forecast} league={league} />
                    ) : (
                      '–'
                    )
                  ) : range ? (
                    range.bestRank === range.worstRank ? (
                      <span
                        className="pill locked"
                        title={
                          rangesApproximate
                            ? 'Innere Näherung – real ggf. breiter'
                            : undefined
                        }
                      >
                        {rangesApproximate ? 'mind. ' : ''}
                        {range.bestRank}.
                      </span>
                    ) : (
                      <span
                        className="pill"
                        title={
                          rangesApproximate
                            ? 'Innere Näherung – real ggf. breiter'
                            : undefined
                        }
                      >
                        {rangesApproximate ? 'mind. ' : ''}
                        {range.bestRank}.–{range.worstRank}.
                      </span>
                    )
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
  teamCount,
}: {
  hardness: ScheduleHardness
  teamCount: number
}) {
  if (!hardness.reliable) {
    return (
      <span
        className="hardness-pill tone-pending"
        title={NOT_ENOUGH_DATA_LABEL}
      >
        –
      </span>
    )
  }
  const tone = hardnessTone(hardness.index)
  const rounded = Math.round(hardness.index)
  return (
    <span
      className={`hardness-pill tone-${tone}`}
      title={`Index ${rounded}/100 · Rang ${hardness.rank}/${teamCount} (1 = schwerstes Restprogramm)`}
    >
      {rounded}
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
