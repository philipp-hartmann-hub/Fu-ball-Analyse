import type { LeagueZoneId } from '../lib/table'
import type { NextMatchdayOutlook, PositionRange, StandingRow } from '../types'
import { zoneLabelFor } from '../lib/table'

interface Props {
  team: StandingRow | null
  seasonRange: PositionRange | null
  nextMatchday: NextMatchdayOutlook | null
  remainingCount: number
  league: LeagueZoneId
  pointsToFirst?: number | null
  pointsAboveRelegation?: number | null
  onEnableMatchdayCutoff?: (matchday: number) => void
  suggestedCutoff?: number | null
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
  const same = range.bestRank === range.worstRank
  return (
    <section className="outlook-block">
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
      {same && (
        <p className="hint tight">Platz in dieser Sicht bereits fest.</p>
      )}
      {note && <p className="hint tight">{note}</p>}
    </section>
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
  onEnableMatchdayCutoff,
  suggestedCutoff,
}: Props) {
  if (!team) {
    return (
      <div className="panel insight">
        <h2>Vereinsanalyse</h2>
        <p className="hint">
          Verein in der Tabelle wählen – du siehst dann Best-/Schlechtfall für den{' '}
          <strong>nächsten Spieltag</strong> und für die <strong>gesamte Saison</strong>.
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

      <div className="outlook-stack">
        {nextMatchday ? (
          <RangeCard
            title={`Variante A · Nach Spieltag ${nextMatchday.matchday}`}
            range={nextMatchday.range}
            league={league}
            note={
              nextMatchday.plays
                ? `Gegner: ${nextMatchday.opponentName}. Exakt über alle ${nextMatchday.fixtureCount} Ergebnisse dieses Spieltags.`
                : `Kein eigenes Spiel – Platz nur über die anderen ${nextMatchday.fixtureCount} Partien.`
            }
          />
        ) : (
          <section className="outlook-block outlook-empty">
            <h3 className="outlook-title">Variante A · Nächster Spieltag</h3>
            <p>Aktuell kein offener Folgespieltag in dieser Sicht.</p>
            {suggestedCutoff != null && onEnableMatchdayCutoff && (
              <button
                type="button"
                className="ghost"
                onClick={() => onEnableMatchdayCutoff(suggestedCutoff)}
              >
                Stand nach Spieltag {suggestedCutoff} setzen
              </button>
            )}
          </section>
        )}

        {seasonRange ? (
          <RangeCard
            title="Variante B · Gesamte Saison (Restprogramm)"
            range={seasonRange}
            league={league}
            note="Eigener Verein gewinnt bzw. verliert alle Restspiele; übrige Partien heuristisch."
          />
        ) : (
          <section className="outlook-block outlook-empty">
            <h3 className="outlook-title">Variante B · Gesamte Saison</h3>
            <p>Keine Saison-Spanne berechenbar.</p>
          </section>
        )}
      </div>
    </div>
  )
}
