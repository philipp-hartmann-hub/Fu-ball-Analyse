import type { CompetitionKind } from '../competitions'
import type { PositionRange, StandingRow } from '../types'
import { zoneLabelFor } from '../lib/table'

interface Props {
  team: StandingRow | null
  range: PositionRange | null
  remainingCount: number
  kind: CompetitionKind
  leagueSize: number
}

export function TeamInsight({
  team,
  range,
  remainingCount,
  kind,
  leagueSize,
}: Props) {
  if (!team) {
    return (
      <div className="panel insight">
        <h2>Vereinsanalyse</h2>
        <p className="hint">Wähle einen Verein in der Tabelle, um mögliche Endplätze zu sehen.</p>
      </div>
    )
  }

  const size = leagueSize || 18
  return (
    <div className="panel insight">
      <div className="insight-head">
        {team.teamIconUrl ? (
          <img src={team.teamIconUrl} alt="" width={40} height={40} />
        ) : (
          <span className="crest-fallback large" aria-hidden />
        )}
        <div>
          <h2>{team.teamName}</h2>
          <p className="meta">
            Aktuell Platz {team.rank} · {team.points} Punkte · {remainingCount} offene Spiele
          </p>
        </div>
      </div>
      {range && (
        <div className="range-card">
          <div>
            <span className="label">Bestfall</span>
            <strong>{range.bestRank}.</strong>
            <span className="sub">{zoneLabelFor(range.bestRank, size, kind)}</span>
          </div>
          <div className="divider" />
          <div>
            <span className="label">Schlechtfall</span>
            <strong>{range.worstRank}.</strong>
            <span className="sub">{zoneLabelFor(range.worstRank, size, kind)}</span>
          </div>
        </div>
      )}
      <p className="hint">
        Best-/Schlechtfall: der Verein gewinnt bzw. verliert alle Restspiele; übrige Partien
        werden heuristisch so gesetzt, dass sie helfen oder schaden.
      </p>
    </div>
  )
}
