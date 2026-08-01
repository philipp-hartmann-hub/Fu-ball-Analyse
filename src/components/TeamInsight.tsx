import type { LeagueZoneId } from '../lib/table'
import type { NextMatchdayOutlook, PositionRange, StandingRow } from '../types'
import { zoneLabelFor } from '../lib/table'

interface Props {
  team: StandingRow | null
  /** Saisonende (alle Restspiele) */
  seasonRange: PositionRange | null
  /** Nur nächster Spieltag */
  nextMatchday: NextMatchdayOutlook | null
  remainingCount: number
  league: LeagueZoneId
  pointsToFirst?: number | null
  pointsAboveRelegation?: number | null
}

function RangeCard({
  title,
  range,
  league,
  note,
}: {
  title: string
  range: PositionRange
  league: LeagueZoneId
  note?: string
}) {
  return (
    <div className="outlook-block">
      <h3 className="outlook-title">{title}</h3>
      <div className="range-card">
        <div>
          <span className="label">Bestfall</span>
          <strong>{range.bestRank}.</strong>
          <span className="sub">{zoneLabelFor(range.bestRank, league)}</span>
        </div>
        <div className="divider" />
        <div>
          <span className="label">Schlechtfall</span>
          <strong>{range.worstRank}.</strong>
          <span className="sub">{zoneLabelFor(range.worstRank, league)}</span>
        </div>
      </div>
      {note && <p className="hint tight">{note}</p>}
    </div>
  )
}

export function TeamInsight({
  team,
  seasonRange,
  nextMatchday,
  remainingCount,
  league,
  pointsToFirst,
  pointsAboveRelegation,
}: Props) {
  if (!team) {
    return (
      <div className="panel insight">
        <h2>Vereinsanalyse</h2>
        <p className="hint">
          Wähle einen Verein in der Tabelle für Detailanalyse und mögliche Plätze.
        </p>
      </div>
    )
  }

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
            Platz {team.rank} · {team.points} Pkt. · {team.won}S {team.draw}U {team.lost}N ·{' '}
            {remainingCount} Restspiele
          </p>
        </div>
      </div>

      <div className="stat-row">
        <div>
          <span className="label">Aktuelle Zone</span>
          <strong>{zoneLabelFor(team.rank, league)}</strong>
        </div>
        {pointsToFirst != null && pointsToFirst > 0 && (
          <div>
            <span className="label">Rückstand Platz 1</span>
            <strong>{pointsToFirst} Pkt.</strong>
          </div>
        )}
        {pointsAboveRelegation != null && (
          <div>
            <span className="label">Vorsprung Platz 16</span>
            <strong>
              {pointsAboveRelegation >= 0 ? `+${pointsAboveRelegation}` : pointsAboveRelegation}{' '}
              Pkt.
            </strong>
          </div>
        )}
      </div>

      {nextMatchday && (
        <RangeCard
          title={`Nach Spieltag ${nextMatchday.matchday}`}
          range={nextMatchday.range}
          league={league}
          note={
            nextMatchday.plays
              ? `Gegner: ${nextMatchday.opponentName} · exakt über alle ${nextMatchday.fixtureCount} Spieltag-Ergebnisse`
              : `Kein eigenes Spiel · Platz nur über die anderen ${nextMatchday.fixtureCount} Partien`
          }
        />
      )}

      {seasonRange && (
        <RangeCard
          title="Saisonende (Restprogramm)"
          range={seasonRange}
          league={league}
          note="Alle Restspiele: eigener Verein max./min. Punkte, übrige Partien heuristisch"
        />
      )}

      {!nextMatchday && !seasonRange && (
        <p className="hint">Keine offenen Spiele – Spanne nicht berechenbar.</p>
      )}
    </div>
  )
}
