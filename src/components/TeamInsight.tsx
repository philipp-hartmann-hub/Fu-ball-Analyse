import { useState, type ReactNode } from 'react'
import type { LeagueZoneId } from '../lib/table'
import type {
  NextMatchdayOutlook,
  PathwayStep,
  PositionRange,
  ScenarioPathway,
  SeasonOutlook,
  StandingRow,
} from '../types'
import { zoneLabelFor } from '../lib/table'

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
}

type PathKind = 'best' | 'worst' | null

function PathwayList({ steps }: { steps: PathwayStep[] }) {
  if (!steps.length) {
    return <p className="hint tight">Keine Spiele in diesem Pathway.</p>
  }
  return (
    <ul className="pathway-list">
      {steps.map((s) => (
        <li key={s.matchId} className={s.involvesFocus ? 'focus' : ''}>
          <span className={`pathway-tip tip-${s.tip}`}>{s.tip}</span>
          <span className="pathway-match">
            {s.homeName} – {s.awayName}
          </span>
          <span className="pathway-score">
            {s.homeGoals}:{s.awayGoals}
          </span>
        </li>
      ))}
    </ul>
  )
}

function VariantPanel({
  heading,
  range,
  league,
  note,
  empty,
  emptyAction,
  bestPathway,
  worstPathway,
  pathwaysEnabled,
}: {
  heading: string
  range: PositionRange | null
  league: LeagueZoneId
  note?: string
  empty?: string
  emptyAction?: ReactNode
  bestPathway?: ScenarioPathway | null
  worstPathway?: ScenarioPathway | null
  pathwaysEnabled?: boolean
}) {
  const [open, setOpen] = useState<PathKind>(null)

  const toggle = (kind: 'best' | 'worst') => {
    if (!pathwaysEnabled) return
    setOpen((prev) => (prev === kind ? null : kind))
  }

  const active = open === 'best' ? bestPathway : open === 'worst' ? worstPathway : null

  return (
    <div className="panel insight-variant">
      <h2 className="variant-heading">{heading}</h2>
      {range ? (
        <>
          <div className="range-card">
            <button
              type="button"
              className={`range-side ${open === 'best' ? 'open' : ''} ${pathwaysEnabled ? 'clickable' : ''}`}
              onClick={() => toggle('best')}
              disabled={!pathwaysEnabled || !bestPathway}
              aria-expanded={open === 'best'}
            >
              <span className="label">Bestfall</span>
              <strong>{range.bestRank}.</strong>
              <span className="sub">{zoneLabelFor(range.bestRank, league)}</span>
              {pathwaysEnabled && bestPathway && (
                <span className="path-hint">
                  {open === 'best' ? 'Pathway ausblenden' : 'Pathway anzeigen'}
                </span>
              )}
            </button>
            <div className="divider" />
            <button
              type="button"
              className={`range-side ${open === 'worst' ? 'open' : ''} ${pathwaysEnabled ? 'clickable' : ''}`}
              onClick={() => toggle('worst')}
              disabled={!pathwaysEnabled || !worstPathway}
              aria-expanded={open === 'worst'}
            >
              <span className="label">Schlechtfall</span>
              <strong>{range.worstRank}.</strong>
              <span className="sub">{zoneLabelFor(range.worstRank, league)}</span>
              {pathwaysEnabled && worstPathway && (
                <span className="path-hint">
                  {open === 'worst' ? 'Pathway ausblenden' : 'Pathway anzeigen'}
                </span>
              )}
            </button>
          </div>

          {active && (
            <div className="pathway-panel">
              <p className="pathway-title">
                {open === 'best' ? 'Best-Case-Pathway' : 'Worst-Case-Pathway'} → Platz{' '}
                {active.rank}.
              </p>
              <PathwayList steps={active.steps} />
            </div>
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
}: Props) {
  if (!team) {
    return (
      <div className="panel insight">
        <h2>Vereinsanalyse</h2>
        <p className="hint">
          Verein wählen – dann siehst du zwei Analysen. Beim Best-/Schlechtfall des nächsten
          Spieltags kannst du den Pathway per Klick öffnen.
        </p>
      </div>
    )
  }

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
        </div>
      </div>

      <VariantPanel
        heading={
          nextMatchday
            ? `Nächster Spieltag (${nextMatchday.matchday}.)`
            : 'Nächster Spieltag'
        }
        range={nextMatchday?.range ?? null}
        league={league}
        pathwaysEnabled
        bestPathway={nextMatchday?.bestPathway}
        worstPathway={nextMatchday?.worstPathway}
        note={
          nextMatchday
            ? nextMatchday.plays
              ? `Gegner: ${nextMatchday.opponentName}. Tippe auf Best-/Schlechtfall für den Pathway.`
              : `Kein eigenes Spiel. Tippe auf Best-/Schlechtfall für den Pathway.`
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
        pathwaysEnabled={false}
        note="Heuristisch über alle Restspiele (Pathway folgt später)."
        empty="Keine Saison-Spanne berechenbar."
      />
    </div>
  )
}
