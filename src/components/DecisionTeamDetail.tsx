import type { DecisionTeamRow } from '../lib/decisions'
import { triggersBeyondStatus } from '../lib/decisions'
import type { ThresholdLine } from '../lib/thresholds'

function TriggerList({
  lines,
  horizon,
  approximate,
}: {
  lines: ThresholdLine[]
  horizon: 'matchday' | 'season'
  approximate: boolean
}) {
  if (lines.length === 0) return null
  return (
    <ul className={`decision-triggers horizon-${horizon}`}>
      {lines.map((t) => (
        <li key={`${horizon}-${t.key}`} className={`tone-${t.tone}`}>
          <span className="horizon-tag">
            {horizon === 'matchday' ? 'Spieltag' : 'Saison'}
          </span>
          <span className="label">{t.label}</span>
          <span className="primary">{t.primary}</span>
          {t.secondary && <span className="secondary">{t.secondary}</span>}
          {approximate && <span className="approx">Näherung</span>}
        </li>
      ))}
    </ul>
  )
}

interface Props {
  row: DecisionTeamRow
  useLive: boolean
  showStatus?: boolean
  showMatchday?: boolean
  showSeason?: boolean
  highlightDelta?: boolean
  /** Kompakte Zeile im Radar-Header (nur Status-Pills) */
  compact?: boolean
}

/** Entscheidungs-Inhalt für einen Verein (Radar + Vereinsansicht). */
export function DecisionTeamDetail({
  row,
  useLive,
  showStatus = true,
  showMatchday = true,
  showSeason = true,
  highlightDelta = false,
  compact = false,
}: Props) {
  const statuses = useLive ? row.liveStatuses : row.confirmedStatuses
  const leftoverSeason = showSeason
    ? triggersBeyondStatus(statuses, row.seasonTriggers)
    : []
  const matchdayLines = showMatchday ? row.matchdayTriggers : []

  return (
    <div className={compact ? 'decision-team-detail compact' : 'decision-team-detail'}>
      {showStatus && statuses.length > 0 && (
        <span className="decision-pills">
          {statuses.map((s) => (
            <span
              key={s.kind}
              className={`decision-pill tone-${s.tone}`}
              title={s.label}
            >
              {s.shortLabel}
              <span className="decision-pill-horizon">Saison</span>
            </span>
          ))}
        </span>
      )}

      {highlightDelta &&
        row.deltas.map((d) => (
          <p
            key={`${d.kind}-${d.status.kind}`}
            className={`decision-delta tone-${d.status.tone}`}
            role="status"
          >
            {d.message}
          </p>
        ))}

      {matchdayLines.length > 0 && (
        <TriggerList
          lines={matchdayLines}
          horizon="matchday"
          approximate={!row.matchdayTriggersExact}
        />
      )}

      {leftoverSeason.length > 0 && (
        <TriggerList lines={leftoverSeason} horizon="season" approximate />
      )}

      {matchdayLines.length === 0 &&
        leftoverSeason.length === 0 &&
        showStatus &&
        statuses.length === 0 &&
        !compact && (
          <p className="hint tight">Keine Entscheidungs-Hinweise.</p>
        )}
    </div>
  )
}
