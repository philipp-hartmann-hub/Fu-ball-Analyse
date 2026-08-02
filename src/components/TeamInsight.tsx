import { useState, type ReactNode } from 'react'
import type { LeagueZoneId } from '../lib/table'
import type {
  CaseConditions,
  MatchOutcome,
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
import type { ExplainTopic } from '../lib/modelExplanations'
import { ExplainLink } from './ExplainLink'

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
  onExplain?: (topic: ExplainTopic) => void
  onApplyConditions?: (conditions: CaseConditions) => void
}

function ThresholdList({
  lines,
  emptyHint,
  summary = 'Punktschwellen',
  onExplain,
}: {
  lines: ThresholdLine[]
  emptyHint?: string
  summary?: string
  onExplain?: (topic: ExplainTopic) => void
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
      {onExplain && (
        <p className="hint tight threshold-explain">
          <ExplainLink topic="thresholds" onExplain={onExplain} />
        </p>
      )}
    </details>
  )
}

function focusResultLabel(r: 'win' | 'draw' | 'loss'): string {
  if (r === 'win') return 'Sieg'
  if (r === 'draw') return 'Remis'
  return 'Niederlage'
}

function foreignOutcomeLine(
  home: string,
  away: string,
  outcome: MatchOutcome,
): string {
  if (outcome === 'home') return `${home} schlägt ${away}`
  if (outcome === 'away') return `${away} schlägt ${home}`
  return `${home} und ${away} trennen sich remis`
}

function ConditionsPanel({
  kind,
  targetRank,
  conditions,
  onApply,
  onExplain,
  onClose,
}: {
  kind: 'best' | 'worst'
  targetRank: number
  conditions: CaseConditions
  onApply?: (conditions: CaseConditions) => void
  onExplain?: (topic: ExplainTopic) => void
  onClose: () => void
}) {
  const [flexOpen, setFlexOpen] = useState(false)
  const heuristic = conditions.mode === 'heuristic'
  const caseLabel = kind === 'best' ? 'Bestfall' : 'Schlechtfall'
  const heading = heuristic
    ? `${caseLabel}: Platz ${targetRank} — das muss passieren (heuristisch)`
    : `${caseLabel}: Platz ${targetRank} — das muss passieren`

  const ownItems =
    heuristic && conditions.ownRest.length > 0
      ? conditions.ownRest
      : conditions.ownMatch
        ? [conditions.ownMatch]
        : []

  const canApply =
    Boolean(onApply) &&
    (conditions.ownMatch != null ||
      conditions.ownRest.length > 0 ||
      conditions.required.length > 0)

  return (
    <div className={`conditions-panel mode-${conditions.mode} case-${kind}`}>
      <div className="conditions-head">
        <h3 className="conditions-title">{heading}</h3>
        <div className="conditions-head-actions">
          {onExplain && (
            <ExplainLink
              topic="conditions"
              onExplain={onExplain}
              className="explain-inline"
            />
          )}
          <button type="button" className="ghost conditions-close" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>

      <div className="conditions-block block-own">
        <h4>Deine Vorgabe</h4>
        {ownItems.length === 0 ? (
          <p className="hint tight">Kein eigenes Spiel in dieser Sicht.</p>
        ) : (
          <ul className="conditions-list">
            {ownItems.map((item) => (
              <li key={item.matchId}>
                <strong>{focusResultLabel(item.focusResult)}</strong>
                {' gegen '}
                {item.opponentName}
                <span className="conditions-meta">
                  {' '}
                  ({item.homeAway === 'H' ? 'Heim' : 'Auswärts'})
                </span>
              </li>
            ))}
          </ul>
        )}
        {heuristic && conditions.ownRest.length > 1 && (
          <p className="hint tight">Alle eigenen Restspiele als Vorgabe.</p>
        )}
      </div>

      <div className="conditions-block block-must">
        <h4>{heuristic ? 'Relevante Konkurrenten' : 'Muss passieren'}</h4>
        {heuristic ? (
          conditions.relevantRivals.length === 0 ? (
            <p className="hint tight">Keine Konkurrenten in Reichweite markiert.</p>
          ) : (
            <>
              <p className="hint tight">
                {kind === 'best'
                  ? 'Diese Teams liegen in Reichweite — ihre Patzer helfen dem Bestfall.'
                  : 'Diese Teams können dich noch überholen — ihre Erfolge belasten den Schlechtfall.'}
              </p>
              <ul className="conditions-list">
                {conditions.relevantRivals.map((r) => (
                  <li key={r.teamId}>
                    {r.teamName}
                    <span className="conditions-meta">
                      {' '}
                      · Platz {r.rank} · {r.points} Pkt.
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : conditions.required.length === 0 ? (
          <p className="hint tight">
            {kind === 'best'
              ? 'Nur dein eigenes Ergebnis zählt für den Bestfall.'
              : 'Nur dein eigenes Ergebnis zählt für den Schlechtfall.'}
          </p>
        ) : (
          <ul className="conditions-list">
            {conditions.required.map((r) => (
              <li key={r.matchId}>
                {foreignOutcomeLine(r.homeName, r.awayName, r.outcome)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="conditions-block block-flex">
        <h4>{heuristic ? 'Ohne Einfluss' : 'Egal'}</h4>
        {conditions.flexible.length === 0 ? (
          <p className="hint tight">Keine weiteren Spiele in dieser Gruppe.</p>
        ) : (
          <>
            <button
              type="button"
              className="ghost conditions-flex-toggle"
              aria-expanded={flexOpen}
              onClick={() => setFlexOpen((v) => !v)}
            >
              {conditions.flexible.length}{' '}
              {conditions.flexible.length === 1 ? 'Spiel' : 'Spiele'}{' '}
              {heuristic
                ? 'ohne Einfluss'
                : `ohne Einfluss auf den ${caseLabel}`}
              {flexOpen ? ' ▾' : ' ▸'}
            </button>
            {flexOpen && (
              <ul className="conditions-list muted">
                {conditions.flexible.map((f) => (
                  <li key={f.matchId}>
                    {f.homeName} – {f.awayName}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {canApply && (
        <div className="conditions-actions">
          <button
            type="button"
            className="ghost"
            onClick={() => onApply?.(conditions)}
          >
            Als Szenario übernehmen
          </button>
          {heuristic && (
            <p className="hint tight">
              Übernimmt nur deine Restspiel-Vorgabe — Fremdspiele bleiben offen.
            </p>
          )}
        </div>
      )}
    </div>
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
  onExplain,
  bestConditions,
  worstConditions,
  onApplyConditions,
}: {
  heading: string
  range: PositionRange | null
  league: LeagueZoneId
  note?: string
  empty?: string
  emptyAction?: ReactNode
  thresholds?: ThresholdLine[]
  thresholdSummary?: string
  onExplain?: (topic: ExplainTopic) => void
  bestConditions?: CaseConditions | null
  worstConditions?: CaseConditions | null
  onApplyConditions?: (conditions: CaseConditions) => void
}) {
  const [openCase, setOpenCase] = useState<'best' | 'worst' | null>(null)

  const toggle = (side: 'best' | 'worst') => {
    const cond = side === 'best' ? bestConditions : worstConditions
    if (!cond) return
    setOpenCase((cur) => (cur === side ? null : side))
  }

  const openConditions =
    openCase === 'best'
      ? bestConditions
      : openCase === 'worst'
        ? worstConditions
        : null

  return (
    <div className="panel insight-variant">
      <div className="variant-head">
        <h2 className="variant-heading">{heading}</h2>
        {onExplain && range && (
          <ExplainLink topic="span" onExplain={onExplain} className="explain-inline" />
        )}
      </div>
      {range ? (
        <>
          <div className="range-card" role="group" aria-label="Best- und Schlechtfall">
            <button
              type="button"
              className={`range-side range-btn${openCase === 'best' ? ' is-open' : ''}${
                bestConditions ? '' : ' is-static'
              }`}
              onClick={() => toggle('best')}
              disabled={!bestConditions}
              aria-expanded={openCase === 'best'}
              aria-controls={bestConditions ? 'conditions-panel-best' : undefined}
            >
              <span className="label">Bestfall</span>
              <strong>{range.bestRank}.</strong>
              <span className="sub">{zoneLabelFor(range.bestRank, league)}</span>
              {bestConditions && (
                <span className="range-hint">
                  {openCase === 'best' ? 'Bedingungen ausblenden' : 'Bedingungen anzeigen'}
                </span>
              )}
            </button>
            <div className="divider" />
            <button
              type="button"
              className={`range-side range-btn${openCase === 'worst' ? ' is-open' : ''}${
                worstConditions ? '' : ' is-static'
              }`}
              onClick={() => toggle('worst')}
              disabled={!worstConditions}
              aria-expanded={openCase === 'worst'}
              aria-controls={worstConditions ? 'conditions-panel-worst' : undefined}
            >
              <span className="label">Schlechtfall</span>
              <strong>{range.worstRank}.</strong>
              <span className="sub">{zoneLabelFor(range.worstRank, league)}</span>
              {worstConditions && (
                <span className="range-hint">
                  {openCase === 'worst' ? 'Bedingungen ausblenden' : 'Bedingungen anzeigen'}
                </span>
              )}
            </button>
          </div>

          {openCase && openConditions && (
            <div id={`conditions-panel-${openCase}`}>
              <ConditionsPanel
                kind={openCase}
                targetRank={
                  openCase === 'best' ? range.bestRank : range.worstRank
                }
                conditions={openConditions}
                onApply={onApplyConditions}
                onExplain={onExplain}
                onClose={() => setOpenCase(null)}
              />
            </div>
          )}

          {thresholds && thresholds.length > 0 && (
            <ThresholdList
              lines={thresholds}
              summary={thresholdSummary}
              onExplain={onExplain}
            />
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
  onExplain,
  onApplyConditions,
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
    scheduleHardness &&
    scheduleHardness.remainingGames > 0 &&
    scheduleHardness.reliable
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
          {scheduleHardness && scheduleHardness.remainingGames > 0 && (
            <div>
              <span className="label">
                Restprogramm
                {onExplain && (
                  <>
                    {' '}
                    <ExplainLink
                      topic="hardness"
                      onExplain={onExplain}
                      className="explain-inline"
                    >
                      Erklärung
                    </ExplainLink>
                  </>
                )}
              </span>
              {scheduleHardness.reliable ? (
                <strong className={`hardness-stat tone-${hardnessToneValue}`}>
                  {Math.round(scheduleHardness.index)}
                  <span className="hardness-stat-meta">
                    {' '}
                    · {scheduleHardness.rank}/{leagueTeamCount}
                    {hardnessLabel ? ` · ${hardnessLabel}` : ''}
                  </span>
                </strong>
              ) : (
                <strong className="hardness-stat tone-pending">
                  noch keine Aussage
                  <span className="hardness-stat-meta"> (zu wenige Spiele)</span>
                </strong>
              )}
            </div>
          )}
        </div>
        {scheduleHardness && scheduleHardness.remainingGames > 0 && scheduleHardness.reliable && (
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
        onExplain={onExplain}
        bestConditions={nextMatchday?.bestConditions ?? null}
        worstConditions={nextMatchday?.worstConditions ?? null}
        onApplyConditions={onApplyConditions}
        note={
          nextMatchday
            ? nextMatchday.plays
              ? `Gegner: ${nextMatchday.opponentName}. Klick auf Best-/Schlechtfall für Bedingungen.`
              : 'Kein eigenes Spiel an diesem Spieltag. Klick auf Best-/Schlechtfall für Bedingungen.'
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
        onExplain={onExplain}
        bestConditions={seasonOutlook?.bestConditions ?? null}
        worstConditions={seasonOutlook?.worstConditions ?? null}
        onApplyConditions={onApplyConditions}
        note="Schätzung über alle Restspiele. Bedingungen heuristisch — Klick auf Best-/Schlechtfall."
        empty="Keine Saison-Spanne berechenbar."
      />
    </div>
  )
}
