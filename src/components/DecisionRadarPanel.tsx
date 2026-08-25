import { useEffect, useRef } from 'react'
import { DecisionTeamDetail } from './DecisionTeamDetail'
import type { DecisionRadar, DecisionTeamRow } from '../lib/decisions'
import type { ExplainTopic } from '../lib/modelExplanations'
import { ExplainLink } from './ExplainLink'

interface Props {
  radar: DecisionRadar
  liveCount: number
  selectedTeamId?: number | null
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

function TeamRow({
  row,
  useLive,
  highlightDelta,
  showMatchdayTriggers,
  showSeasonTriggers,
  selected,
  onSelect,
}: {
  row: DecisionTeamRow
  useLive: boolean
  highlightDelta: boolean
  showMatchdayTriggers: boolean
  showSeasonTriggers: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li
      data-decision-team={row.teamId}
      className={[
        'decision-row',
        highlightDelta && row.deltas.length > 0 ? 'has-delta' : '',
        selected ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" className="decision-row-main" onClick={onSelect}>
        <span className="decision-rank">{row.rank}.</span>
        <Crest url={row.teamIconUrl} name={row.shortName} />
        <span className="decision-name">{row.shortName}</span>
        <DecisionTeamDetail
          row={row}
          useLive={useLive}
          showStatus
          showMatchday={false}
          showSeason={false}
          compact
        />
      </button>
      <DecisionTeamDetail
        row={row}
        useLive={useLive}
        showStatus={false}
        showMatchday={showMatchdayTriggers}
        showSeason={showSeasonTriggers}
        highlightDelta={highlightDelta}
      />
    </li>
  )
}

export function DecisionRadarPanel({
  radar,
  liveCount,
  selectedTeamId = null,
  onSelectTeam,
  onExplain,
}: Props) {
  const useLive = radar.hasLive
  const showMatchday = radar.showMatchdayHorizon
  const rootRef = useRef<HTMLElement>(null)
  const seasonDeltas = radar.all.filter((r) => r.deltas.length > 0)
  const decided = radar.decided
  const seasonNear = radar.all.filter(
    (r) =>
      r.deltas.length === 0 &&
      (useLive ? r.liveStatuses : r.confirmedStatuses).length === 0 &&
      r.seasonTriggers.length > 0,
  )
  const matchdayRows = showMatchday
    ? radar.all.filter((r) => r.matchdayTriggers.length > 0)
    : []
  const visibleIds = new Set([
    ...seasonDeltas.map((r) => r.teamId),
    ...matchdayRows.map((r) => r.teamId),
    ...decided.map((r) => r.teamId),
    ...seasonNear.map((r) => r.teamId),
  ])
  const focusRow =
    selectedTeamId != null && !visibleIds.has(selectedTeamId)
      ? (radar.all.find((r) => r.teamId === selectedTeamId) ?? null)
      : null

  useEffect(() => {
    if (selectedTeamId == null) return
    const el = rootRef.current?.querySelector(
      `[data-decision-team="${selectedTeamId}"]`,
    )
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedTeamId, radar])

  return (
    <section
      ref={rootRef}
      className="panel decision-radar"
      aria-label="Entscheidungs-Radar"
    >
      <div className="panel-head">
        <h2>Entscheidungen</h2>
        {onExplain && (
          <span className="panel-head-links">
            <ExplainLink topic="decisions" onExplain={onExplain} />
          </span>
        )}
      </div>

      <p className="hint tight decision-intro">
        Zwei Ebenen: <strong>Spieltag</strong> = Tabellenplatz nach diesen
        Spielen; <strong>Saison</strong> = was über alle Restspiele feststeht.
        Passiv, ohne Alerts.
      </p>

      {liveCount > 0 ? (
        <p className="decision-live-banner" role="status">
          <span className="live-dot" aria-hidden />
          {liveCount} Spiel{liveCount === 1 ? '' : 'e'} live — Zwischenstand in
          der Spieltags-Ebene, Saison-Folgen darunter
        </p>
      ) : radar.matchdayAtHand && radar.nextMatchday != null ? (
        <p className="hint tight">
          Spieltag {radar.nextMatchday} steht an — Positions-Hinweise für diesen
          Spieltag.
        </p>
      ) : showMatchday && radar.nextMatchday != null ? (
        <p className="hint tight">
          Nächster Spieltag: {radar.nextMatchday} — Spieltags-Ebene zeigt die
          mögliche Tabelle danach.
        </p>
      ) : (
        <p className="hint tight">Keine offenen Spiele — nur Saison-Ebene.</p>
      )}

      {showMatchday && (
        <div className="decision-block">
          <h3 className="decision-block-title">
            Spieltag
            {radar.nextMatchday != null ? ` · ST ${radar.nextMatchday}` : ''}
          </h3>
          <p className="hint tight">
            Relevante Plätze nach allen Spieltags-Konstellationen
            (Tabellenführer, CL/EL/Aufstieg, Relegation, Abstieg) — auch wenn
            der Verein dort schon steht. Ohne solche Chance erscheint er hier
            nicht
            {matchdayRows.some((r) => !r.matchdayTriggersExact)
              ? ' (ggf. Näherung)'
              : ''}
            .
          </p>
          {matchdayRows.length === 0 ? (
            <p className="hint tight">
              Keine spieltagsrelevante Positionsaussage für die Vereine.
            </p>
          ) : (
            <ul className="decision-list">
              {matchdayRows.map((row) => (
                <TeamRow
                  key={`md-${row.teamId}`}
                  row={row}
                  useLive={useLive}
                  highlightDelta={false}
                  showMatchdayTriggers
                  showSeasonTriggers={false}
                  selected={selectedTeamId === row.teamId}
                  onSelect={() => onSelectTeam(row.teamId)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="decision-block">
        <h3 className="decision-block-title">Saison</h3>
        <p className="hint tight">
          Nur echte Saison-Gewissheiten aus harten Grenzen (wie Möglich) über
          alle Restspiele.
        </p>

        {seasonDeltas.length > 0 && (
          <div className="decision-subblock">
            <h4 className="decision-sub-title">Live → Saison-Folge</h4>
            <p className="hint tight">
              Zwischenstand als Auslöser; die Konsequenz gilt für die restliche
              Saison.
            </p>
            <ul className="decision-list">
              {seasonDeltas.map((row) => (
                <TeamRow
                  key={`delta-${row.teamId}`}
                  row={row}
                  useLive={useLive}
                  highlightDelta
                  showMatchdayTriggers={false}
                  showSeasonTriggers
                  selected={selectedTeamId === row.teamId}
                  onSelect={() => onSelectTeam(row.teamId)}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="decision-subblock">
          <h4 className="decision-sub-title">Steht fest</h4>
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
                  showSeasonTriggers
                  selected={selectedTeamId === row.teamId}
                  onSelect={() => onSelectTeam(row.teamId)}
                />
              ))}
            </ul>
          )}
        </div>

        {(seasonNear.length > 0 || focusRow) && (
          <div className="decision-subblock">
            <h4 className="decision-sub-title">Noch offen</h4>
            <p className="hint tight">
              Clinch-Hinweise nur wenn die Zone noch offen und (ggf. diesen
              Spieltag) kippbar ist — als Näherung gekennzeichnet.
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
                  selected={selectedTeamId === row.teamId}
                  onSelect={() => onSelectTeam(row.teamId)}
                />
              ))}
              {focusRow && (
                <TeamRow
                  key={`focus-${focusRow.teamId}`}
                  row={focusRow}
                  useLive={useLive}
                  highlightDelta={false}
                  showMatchdayTriggers={showMatchday}
                  showSeasonTriggers
                  selected
                  onSelect={() => onSelectTeam(focusRow.teamId)}
                />
              )}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
