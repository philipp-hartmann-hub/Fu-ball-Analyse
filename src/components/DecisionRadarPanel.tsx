import type { DecisionRadar, DecisionTeamRow } from '../lib/decisions'
import type { ThresholdLine } from '../lib/thresholds'
import type { ExplainTopic } from '../lib/modelExplanations'
import { ExplainLink } from './ExplainLink'

interface Props {
  radar: DecisionRadar
  liveCount: number
  onSelectTeam: (teamId: number) => void
  onExplain?: (topic: ExplainTopic) => void
}

function Crest({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      <img
        className="crest-img"
        src={url}
        alt=""
        width={22}
        height={22}
        title={name}
        loading="lazy"
      />
    )
  }
  return <span className="crest-fallback" aria-hidden title={name} />
}

function StatusPills({
  row,
  useLive,
}: {
  row: DecisionTeamRow
  useLive: boolean
}) {
  const statuses = useLive ? row.liveStatuses : row.confirmedStatuses
  if (statuses.length === 0) {
    const hard = useLive ? row.liveHard : row.confirmedHard
    return (
      <span className="decision-range" title="Mögliche Endplätze (Saison)">
        {hard.hardBest === hard.hardWorst
          ? `${hard.hardBest}.`
          : `${hard.hardBest}.–${hard.hardWorst}.`}
      </span>
    )
  }
  return (
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
  )
}

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
            {horizon === 'matchday' ? 'Diesen Spieltag' : 'Saison'}
          </span>
          <span className="label">{t.label}</span>
          <span className="primary">{t.primary}</span>
          {t.secondary && <span className="secondary">{t.secondary}</span>}
          {approximate && <span className="approx">Näherung</span>}
          {!approximate && horizon === 'matchday' && (
            <span className="approx exact">exakt</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function TeamRow({
  row,
  useLive,
  highlightDelta,
  showMatchdayTriggers,
  showSeasonTriggers,
  onSelect,
}: {
  row: DecisionTeamRow
  useLive: boolean
  highlightDelta: boolean
  showMatchdayTriggers: boolean
  showSeasonTriggers: boolean
  onSelect: () => void
}) {
  const statuses = useLive ? row.liveStatuses : row.confirmedStatuses
  const showTriggers = statuses.length === 0

  return (
    <li
      className={[
        'decision-row',
        highlightDelta && row.deltas.length > 0 ? 'has-delta' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" className="decision-row-main" onClick={onSelect}>
        <span className="decision-rank">{row.rank}.</span>
        <Crest url={row.teamIconUrl} name={row.shortName} />
        <span className="decision-name">{row.shortName}</span>
        <StatusPills row={row} useLive={useLive} />
      </button>
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
      {showTriggers && showMatchdayTriggers && (
        <TriggerList
          lines={row.matchdayTriggers}
          horizon="matchday"
          approximate={!row.matchdayTriggersExact}
        />
      )}
      {showTriggers && showSeasonTriggers && (
        <TriggerList
          lines={row.seasonTriggers}
          horizon="season"
          approximate
        />
      )}
    </li>
  )
}

export function DecisionRadarPanel({
  radar,
  liveCount,
  onSelectTeam,
  onExplain,
}: Props) {
  const useLive = radar.hasLive
  const showMatchday = radar.showMatchdayHorizon
  const deltaRows = showMatchday
    ? radar.all.filter((r) => r.deltas.length > 0)
    : []
  const decided = radar.decided
  const seasonNear = radar.pending.filter(
    (r) =>
      r.deltas.length === 0 &&
      (useLive ? r.liveStatuses : r.confirmedStatuses).length === 0 &&
      r.seasonTriggers.length > 0,
  )
  const matchdayNear =
    showMatchday
      ? radar.pending.filter(
          (r) =>
            r.deltas.length === 0 &&
            (useLive ? r.liveStatuses : r.confirmedStatuses).length === 0 &&
            r.matchdayTriggers.length > 0,
        )
      : []

  return (
    <section className="panel decision-radar" aria-label="Entscheidungs-Radar">
      <div className="panel-head">
        <h2>Entscheidungen</h2>
        {onExplain && (
          <ExplainLink topic="decisions" onExplain={onExplain} />
        )}
      </div>

      <p className="hint tight decision-intro">
        Status = was für die <strong>gesamte Saison</strong> feststeht. Auslöser
        getrennt nach <strong>Spieltag</strong> und <strong>Saison</strong>.
        Passiv, ohne Alerts.
      </p>

      {liveCount > 0 ? (
        <p className="decision-live-banner" role="status">
          <span className="live-dot" aria-hidden />
          {liveCount} Spiel{liveCount === 1 ? '' : 'e'} live — Zwischenstand als
          Auslöser, Folge gilt für die Saison
        </p>
      ) : showMatchday && radar.nextMatchday != null ? (
        <p className="hint tight">
          Spieltag {radar.nextMatchday} steht an — Hinweise für diesen Spieltag
          sichtbar.
        </p>
      ) : (
        <p className="hint tight">
          Kein laufender Spieltag — nur Saison-Status und Saison-Auslöser.
        </p>
      )}

      {deltaRows.length > 0 && (
        <div className="decision-block">
          <h3 className="decision-block-title">
            Live → Saison-Folge
          </h3>
          <p className="hint tight">
            Auslöser ist der laufende Zwischenstand; die Konsequenz gilt für die
            restliche Saison.
          </p>
          <ul className="decision-list">
            {deltaRows.map((row) => (
              <TeamRow
                key={`delta-${row.teamId}`}
                row={row}
                useLive={useLive}
                highlightDelta
                showMatchdayTriggers={false}
                showSeasonTriggers={false}
                onSelect={() => onSelectTeam(row.teamId)}
              />
            ))}
          </ul>
        </div>
      )}

      {showMatchday && matchdayNear.length > 0 && (
        <div className="decision-block">
          <h3 className="decision-block-title">
            Diesen Spieltag
            {radar.nextMatchday != null ? ` · ST ${radar.nextMatchday}` : ''}
          </h3>
          <p className="hint tight">
            Was sich heute entscheiden kann
            {matchdayNear.some((r) => r.matchdayTriggersExact)
              ? ' (exakte Enumeration)'
              : ' (ggf. Näherung)'}
            .
          </p>
          <ul className="decision-list">
            {matchdayNear.map((row) => (
              <TeamRow
                key={`md-${row.teamId}`}
                row={row}
                useLive={useLive}
                highlightDelta={false}
                showMatchdayTriggers
                showSeasonTriggers={false}
                onSelect={() => onSelectTeam(row.teamId)}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="decision-block">
        <h3 className="decision-block-title">Saison steht fest</h3>
        <p className="hint tight">
          Garantiert aus harten Grenzen über alle Restspiele — nicht nur für
          heute.
        </p>
        {decided.length === 0 ? (
          <p className="hint tight">Noch keine garantierten Saison-Statusse.</p>
        ) : (
          <ul className="decision-list">
            {decided.map((row) => (
              <TeamRow
                key={`dec-${row.teamId}`}
                row={row}
                useLive={useLive}
                highlightDelta={false}
                showMatchdayTriggers={false}
                showSeasonTriggers={false}
                onSelect={() => onSelectTeam(row.teamId)}
              />
            ))}
          </ul>
        )}
      </div>

      {seasonNear.length > 0 && (
        <div className="decision-block">
          <h3 className="decision-block-title">Saison noch offen</h3>
          <p className="hint tight">
            Auslöser über mehrere Spieltage — als Näherung gekennzeichnet.
          </p>
          <ul className="decision-list">
            {seasonNear.map((row) => (
              <TeamRow
                key={`season-${row.teamId}`}
                row={row}
                useLive={useLive}
                highlightDelta={false}
                showMatchdayTriggers={false}
                showSeasonTriggers
                onSelect={() => onSelectTeam(row.teamId)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
