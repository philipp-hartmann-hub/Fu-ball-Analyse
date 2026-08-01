import type { CompetitionKind } from '../competitions'
import type { PositionRange, StandingRow } from '../types'
import { zoneForRank } from '../lib/table'

interface Props {
  standings: StandingRow[]
  ranges: PositionRange[]
  selectedTeamId: number | null
  onSelectTeam: (teamId: number) => void
  highlightScenarios: boolean
  kind: CompetitionKind
}

export function StandingsTable({
  standings,
  ranges,
  selectedTeamId,
  onSelectTeam,
  highlightScenarios,
  kind,
}: Props) {
  const rangeMap = new Map(ranges.map((r) => [r.teamId, r]))
  const size = standings.length

  return (
    <div className="table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th className="num">#</th>
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
            const zone = zoneForRank(row.rank, size, kind)
            const selected = selectedTeamId === row.teamId
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
