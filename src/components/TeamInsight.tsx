import type { ReactNode } from 'react'
import type { LeagueZoneId } from '../lib/table'
import type {
  NextMatchdayOutlook,
  PositionRange,
  SeasonOutlook,
  StandingRow,
} from '../types'
import { zoneLabelFor } from '../lib/table'
import type { ThresholdLine } from '../lib/thresholds'
import {
  hardnessTone,
  type ScheduleHardness,
} from '../lib/schedule'

interface Props {
  team: StandingRow | null
  seasonOutlook: SeasonOutlook | null
  nextMatchday: NextMatchdayOutlook | null
  remainingCount: number
  league: LeagueZoneId
  pointsToFirst?: number | null
  pointsAboveRelegation?: number | null
  onEnableMatchdayCutoff?: (matchday: number) => void
  suggestedCutoff?: number | null
  matchdayThresholds?: ThresholdLine[]
  seasonThresholds?: ThresholdLine[]
  scheduleHardness?: ScheduleHardness | null
  leagueTeamCount?: number
}

function ThresholdList({
  lines,
  emptyHint,
  summary = 'Punktschwellen',
}: {
  lines: ThresholdLine[]
  emptyHint?: string
  summary?: string
}) {
  if (!lines.length) {
    return emptyHint ? <p className="hint tight">{emptyHint}</p> : null
  }
  return (
    <details className="threshold-details">
      <summary className="threshold-summary">
        {summary}
        <span className="threshold-count">{lines.length}</span>
      </summary>
      <ul className="threshold-list">
        {lines.map((line) => (
          <li key={line.key} className={`threshold-item tone-${line.tone}`}>
            <span className="threshold-label">{line.label}</span>
            <span className="threshold-primary">{line.primary}</span>
            {line.secondary && (
              <span className="threshold-secondary">{line.secondary}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

function VariantPanel({
  heading,
  range,
  league,
  note,
  empty,
  emptyAction,
  thresholds,
  thresholdSummary,
}: {
  heading: string
  range: PositionRange | null
  league: LeagueZoneId
  note?: string
  empty?: string
  emptyAction?: ReactNode
  thresholds?: ThresholdLine[]
  thresholdSummary?: string
}) {
  return (
    <div className="panel insight-variant">
      <h2 className="variant-heading">{heading}</h2>
      {range ? (
        <>
          <div className="range-card">
            <div className="range-side">
              <span className="label">Bestfall</span>
              <strong>{range.bestRank}.</strong>
              <span className="sub">{zoneLabelFor(range.bestRank, league)}</span>
            </div>
            <div className="divider" />
            <div className="range-side">
              <span className="label">Schlechtfall</span>
              <strong>{range.worstRank}.</strong>
              <span className="sub">{zoneLabelFor(range.worstRank, league)}</span>
            </div>
          </div>

          {thresholds && thresholds.length > 0 && (
            <ThresholdList lines={thresholds} summary={thresholdSummary} />
          )}

          {range.bestRank === range.worstRank && (
            <p className="hint tight">Platz in dieser Sicht bereits fest.</p>
          )}
          {note && <p className="hint tight">{note}</p>}
        </>
      ) : (
        <div className="outlook-empty">
          <p>{empty ?? 'Keine Daten.'}</p>
          {emptyAction}
        </div>
      )}
    </div>
  )
}

export function TeamInsight({
  team,
  seasonOutlook,
  nextMatchday,
  remainingCount,
  league,
  pointsToFirst,
  pointsAboveRelegation,
  onEnableMatchdayCutoff,
  suggestedCutoff,
  matchdayThresholds = [],
  seasonThresholds = [],
  scheduleHardness = null,
  leagueTeamCount = 18,
}: Props) {
  if (!team) {
    return (
      <div className="panel insight">
        <h2>Vereinsanalyse</h2>
        <p className="hint">
          Verein wählen – dann siehst du Best-/Schlechtfall für den nächsten Spieltag und die
          Saison.
        </p>
      </div>
    )
  }

  const hardnessToneValue =
    scheduleHardness && scheduleHardness.remainingGames > 0
      ? hardnessTone(scheduleHardness.index)
      : null
  const hardnessLabel =
    hardnessToneValue === 'hard'
      ? 'schwer'
      : hardnessToneValue === 'easy'
        ? 'leicht'
        : hardnessToneValue === 'mid'
          ? 'mittel'
          : null

  return (
    <div className="insight-column">
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
                {pointsAboveRelegation >= 0
                  ? `+${pointsAboveRelegation}`
                  : pointsAboveRelegation}{' '}
                Pkt.
              </strong>
            </div>
          )}
          {scheduleHardness && scheduleHardness.remainingGames > 0 && hardnessToneValue && (
            <div>
              <span className="label">Restprogramm</span>
              <strong className={`hardness-stat tone-${hardnessToneValue}`}>
                {Math.round(scheduleHardness.index)}
                <span className="hardness-stat-meta">
                  {' '}
                  · {scheduleHardness.rank}/{leagueTeamCount}
                  {hardnessLabel ? ` · ${hardnessLabel}` : ''}
                </span>
              </strong>
            </div>
          )}
        </div>
        {scheduleHardness && scheduleHardness.remainingGames > 0 && (
          <p className="hint tight">
            Härte 0–100 (höher = schwerer Gegner-Schnitt, Heim/Auswärts gewichtet). Rang 1 =
            schwerstes Restprogramm der Liga.
          </p>
        )}
      </div>

      <VariantPanel
        heading={
          nextMatchday
            ? `Nächster Spieltag (${nextMatchday.matchday}.)`
            : 'Nächster Spieltag'
        }
        range={nextMatchday?.range ?? null}
        league={league}
        thresholds={matchdayThresholds}
        thresholdSummary="Nach dem nächsten Spieltag"
        note={
          nextMatchday
            ? nextMatchday.plays
              ? `Gegner: ${nextMatchday.opponentName}.`
              : 'Kein eigenes Spiel an diesem Spieltag.'
            : undefined
        }
        empty="Kein offener Folgespieltag in dieser Sicht."
        emptyAction={
          suggestedCutoff != null && onEnableMatchdayCutoff ? (
            <button
              type="button"
              className="ghost"
              onClick={() => onEnableMatchdayCutoff(suggestedCutoff)}
            >
              Stand nach Spieltag {suggestedCutoff} setzen
            </button>
          ) : null
        }
      />

      <VariantPanel
        heading="Gesamte Saison"
        range={seasonOutlook?.range ?? null}
        league={league}
        thresholds={seasonThresholds}
        thresholdSummary="Saison (Schätzung)"
        note="Schätzung über alle Restspiele (Kennzahlen genähert)."
        empty="Keine Saison-Spanne berechenbar."
      />
    </div>
  )
}
