import type { PositionRange, StandingRow } from '../types'

interface Props {
  team: StandingRow | null
  range: PositionRange | null
  remainingCount: number
}

const ZONE_LABELS: Record<number, string> = {
  1: 'Meister',
  2: 'Champions League',
  3: 'Champions League',
  4: 'Champions League',
  5: 'Europa League',
  6: 'Conference League',
}

function zoneLabel(rank: number, size: number): string {
  if (ZONE_LABELS[rank]) return ZONE_LABELS[rank]!
  if (rank === size - 2) return 'Relegation'
  if (rank >= size - 1) return 'Abstieg'
  return 'Mittelfeld'
}

export function TeamInsight({ team, range, remainingCount }: Props) {
  if (!team) {
    return (
      <div className="panel insight">
        <h2>Vereinsanalyse</h2>
        <p className="hint">Wähle einen Verein in der Tabelle, um mögliche Endplätze zu sehen.</p>
      </div>
    )
  }

  const size = 18
  return (
    <div className="panel insight">
      <div className="insight-head">
        <img src={team.teamIconUrl} alt="" width={40} height={40} />
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
            <span className="sub">{zoneLabel(range.bestRank, size)}</span>
          </div>
          <div className="divider" />
          <div>
            <span className="label">Schlechtfall</span>
            <strong>{range.worstRank}.</strong>
            <span className="sub">{zoneLabel(range.worstRank, size)}</span>
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
