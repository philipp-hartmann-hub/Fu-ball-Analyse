import type { LeagueZoneId } from '../lib/table'
import type { PositionRange, StandingRow } from '../types'
import { zoneForRank } from '../lib/table'

interface Props {
  standings: StandingRow[]
  baseline?: StandingRow[] | null
  ranges: PositionRange[]
  selectedTeamId: number | null
  onSelectTeam: (teamId: number) => void
  highlightScenarios: boolean
  league: LeagueZoneId
}

export function StandingsTable({
  standings,
  baseline,
  ranges,
  selectedTeamId,
  onSelectTeam,
  highlightScenarios,
  league,
}: Props) {
  const rangeMap = new Map(ranges.map((r) => [r.teamId, r]))
  const baseRank = new Map((baseline ?? []).map((r) => [r.teamId, r.rank]))

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
            <th className="num">Sp</th>
            <th className="num">S</th>
            <th className="num">U</th>
            <th className="num">N</th>
            <th className="num">Tore</th>
            <th className="num">Diff</th>
            <th className="num">Pkt</th>
            <th className="range">Möglich</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const range = rangeMap.get(row.teamId)
            const zone = zoneForRank(row.rank, league)
            const selected = selectedTeamId === row.teamId
            const prev = baseRank.get(row.teamId)
            const delta = prev != null ? prev - row.rank : 0
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
                <td className="num">{row.played}</td>
                <td className="num">{row.won}</td>
                <td className="num">{row.draw}</td>
                <td className="num">{row.lost}</td>
                <td className="num">
                  {row.goalsFor}:{row.goalsAgainst}
                </td>
                <td className="num">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                <td className="num pts">{row.points}</td>
                <td className="range">
                  {range ? (
                    range.bestRank === range.worstRank ? (
                      <span className="pill locked">{range.bestRank}.</span>
                    ) : (
                      <span className="pill">
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
