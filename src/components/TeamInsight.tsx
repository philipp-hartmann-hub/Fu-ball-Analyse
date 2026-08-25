import { useMemo, useState, type ReactNode } from 'react'
import type { LeagueZoneId } from '../lib/table'
import type {
  CaseConditions,
  HardRange,
  Match,
  MatchOutcome,
  NextMatchdayOutlook,
  PositionRange,
  ScenarioResult,
  SeasonOutlook,
  StandingRow,
  TargetComparator,
  TargetOutlook,
  TargetOwnOption,
} from '../types'
import {
  forecastZoneLabel,
  relegationCutoffRank,
  zoneLabelFor,
} from '../lib/table'
import {
  hardnessGradeLabelForClub,
  type ScheduleHardness,
} from '../lib/schedule'
import {
  deriveMatchLean,
  forecastZoneBreakdown,
  predictFixture,
  type TeamForecast,
} from '../lib/simulation'
import { NOT_ENOUGH_DATA_LABEL } from '../lib/reliability'
import type { ExplainTopic } from '../lib/modelExplanations'
import type { DecisionTeamRow } from '../lib/decisions'
import type { TeamTrend } from '../lib/trend'
import { DecisionTeamDetail } from './DecisionTeamDetail'
import { ExplainLink } from './ExplainLink'
import { MatchLeanChip } from './MatchLeanChip'
import { MatchPredictionCard } from './MatchPredictionCard'
import { TrendBadge } from './TrendBadge'

interface Props {
  team: StandingRow | null
  seasonOutlook: SeasonOutlook | null
  nextMatchday: NextMatchdayOutlook | null
  matchdayTargetOutlook?: TargetOutlook | null
  /** false = Monte-Carlo-Prozente in der UI unterdrücken */
  forecastReliable?: boolean
  forecast?: TeamForecast | null
  forecastLoading?: boolean
  matchdayOutlookLoading?: boolean
  matchdayTargetRank: number
  matchdayTargetComparator: TargetComparator
  onMatchdayTargetRankChange: (rank: number) => void
  onMatchdayTargetComparatorChange: (c: TargetComparator) => void
  remainingCount: number
  league: LeagueZoneId
  pointsToFirst?: number | null
  pointsAboveRelegation?: number | null
  onEnableMatchdayCutoff?: (matchday: number) => void
  suggestedCutoff?: number | null
  scheduleHardness?: ScheduleHardness | null
  /** Form-Trend relativ zur Gegner-Erwartung */
  teamTrend?: TeamTrend | null
  leagueTeamCount?: number
  /** Aktuelle Tabelle für Poisson-Spielschätzung */
  standings?: StandingRow[]
  /** Offene Spiele (nächstes eigenes Spiel finden) */
  openMatches?: Match[]
  /** Abgeschlossene Spiele für Stärkemodell */
  playedMatches?: Match[]
  /** Gesetzte Szenarien — überschreiben die Spielschätzung */
  scenarios?: ScenarioResult[]
  onExplain?: (topic: ExplainTopic) => void
  onApplyConditions?: (conditions: CaseConditions) => void
  /** Wechselt zum Reiter Entscheidungen (Radar) */
  onOpenDecisions?: () => void
  /** Entscheidungs-Zeilen für diesen Verein (Radar) */
  decisionRow?: DecisionTeamRow | null
  decisionHasLive?: boolean
  decisionNextMatchday?: number | null
}

function DecisionsHint({ onOpen }: { onOpen?: () => void }) {
  if (!onOpen) return null
  return (
    <p className="hint tight decisions-hint">
      Mehr im Tab{' '}
      <button type="button" className="linkish" onClick={onOpen}>
        Entscheidungen
      </button>
      .
    </p>
  )
}

function DecisionInsightBlock({
  row,
  useLive,
  nextMatchday,
  onExplain,
  onOpenDecisions,
}: {
  row: DecisionTeamRow
  useLive: boolean
  nextMatchday: number | null | undefined
  onExplain?: (topic: ExplainTopic) => void
  onOpenDecisions?: () => void
}) {
  return (
    <div className="insight-decisions">
      <div className="forecast-breakdown-head">
        <span className="label">
          Entscheidungen
          {onExplain && (
            <>
              {' '}
              <ExplainLink
                topic="decisions"
                onExplain={onExplain}
                className="explain-inline"
              >
                Erklärung
              </ExplainLink>
            </>
          )}
        </span>
      </div>
      {nextMatchday != null && (
        <p className="hint tight">
          Spieltag {nextMatchday} und Saison — dieselben Hinweise wie im
          Entscheidungs-Radar.
        </p>
      )}
      <DecisionTeamDetail
        row={row}
        useLive={useLive}
        highlightDelta={useLive}
      />
      <DecisionsHint onOpen={onOpenDecisions} />
    </div>
  )
}

/** Native Klappe: zu als Default, Tastatur über summary, aria-expanded am Umschalter. */
function Disclosure({
  closedLabel,
  openLabel,
  children,
}: {
  closedLabel: string
  openLabel: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <details
      className="insight-disclosure"
      onToggle={(e) => {
        setOpen((e.currentTarget as HTMLDetailsElement).open)
      }}
    >
      <summary aria-expanded={open}>
        {open ? openLabel : closedLabel}
      </summary>
      <div className="insight-disclosure-body">{children}</div>
    </details>
  )
}

/** Alle Zonen-Szenarien mit % (Tabelle zeigt nur die wahrscheinlichste). */
function ForecastZoneBreakdown({
  forecast,
  loading,
  reliable,
  league,
  onExplain,
}: {
  forecast: TeamForecast | null | undefined
  loading?: boolean
  reliable: boolean
  league: LeagueZoneId
  onExplain?: (topic: ExplainTopic) => void
}) {
  const rows = useMemo(() => {
    if (!forecast || !reliable) return []
    return forecastZoneBreakdown(forecast, league).filter((r) => r.probability > 0)
  }, [forecast, reliable, league])

  return (
    <div className="forecast-breakdown">
      <div className="forecast-breakdown-head">
        <span className="label">
          Saison-Prognose
          {onExplain && (
            <>
              {' '}
              <ExplainLink
                topic="forecast"
                onExplain={onExplain}
                className="explain-inline"
              >
                Erklärung
              </ExplainLink>
            </>
          )}
        </span>
      </div>
      {loading && !forecast ? (
        <p className="hint tight">Prognose wird berechnet…</p>
      ) : !reliable ? (
        <p className="hint tight forecast-pending-note">{NOT_ENOUGH_DATA_LABEL}</p>
      ) : !forecast || !rows.length ? (
        <p className="hint tight">Keine Prognose verfügbar.</p>
      ) : (
        <>
          <p className="forecast-breakdown-meta">
            Median Platz {forecast.medianRank} · ~{forecast.expectedPoints.toFixed(1)}{' '}
            Pkt.
          </p>
          <ul className="forecast-breakdown-list">
            {rows.map(({ zone, probability }, i) => {
              const pct = Math.round(probability * 100)
              return (
                <li
                  key={zone}
                  className={`forecast-breakdown-row${i === 0 ? ' is-primary' : ''}`}
                >
                  <span className="forecast-breakdown-label">
                    {forecastZoneLabel(zone, league)}
                  </span>
                  <span className="forecast-breakdown-pct">{pct}%</span>
                  <div className="forecast-bar" aria-hidden>
                    <span
                      className={`forecast-fill zone-${zone}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function focusResultLabel(r: 'win' | 'draw' | 'loss'): string {
  if (r === 'win') return 'Sieg'
  if (r === 'draw') return 'Remis'
  return 'Niederlage'
}

function outcomeBadgeLabel(outcome: MatchOutcome): string {
  if (outcome === 'home') return '1'
  if (outcome === 'away') return '2'
  return 'X'
}

function Crest({
  url,
  name,
  size = 28,
}: {
  url?: string | null
  name: string
  size?: number
}) {
  if (url) {
    return (
      <img
        className="crest-img"
        src={url}
        alt=""
        width={size}
        height={size}
        title={name}
        loading="lazy"
      />
    )
  }
  return (
    <span
      className={`crest-fallback${size >= 36 ? ' large' : ''}`}
      style={size !== 22 && size !== 40 ? { width: size, height: size } : undefined}
      aria-hidden
      title={name}
    />
  )
}

function FixtureCrestRow({
  homeName,
  awayName,
  homeIconUrl,
  awayIconUrl,
  outcome,
  detail,
}: {
  homeName: string
  awayName: string
  homeIconUrl?: string
  awayIconUrl?: string
  outcome?: MatchOutcome
  detail?: string
}) {
  return (
    <div className="fixture-crest-row">
      <div className="fixture-crest-teams">
        <span className="fixture-crest-side">
          <Crest url={homeIconUrl} name={homeName} size={24} />
          <span className="fixture-crest-name">{homeName}</span>
        </span>
        <span className="fixture-crest-vs" aria-hidden>
          –
        </span>
        <span className="fixture-crest-side away">
          <span className="fixture-crest-name">{awayName}</span>
          <Crest url={awayIconUrl} name={awayName} size={24} />
        </span>
      </div>
      {outcome && (
        <span className={`outcome-chip tone-${outcome}`} title={foreignOutcomeLine(homeName, awayName, outcome)}>
          {outcomeBadgeLabel(outcome)}
        </span>
      )}
      {detail && <span className="fixture-crest-detail">{detail}</span>}
    </div>
  )
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

function forbiddenOutcomeLine(
  home: string,
  away: string,
  forbidden: MatchOutcome,
): string {
  if (forbidden === 'home') return `${home} darf nicht siegen`
  if (forbidden === 'away') return `${away} darf nicht siegen`
  return `${home}–${away} darf nicht remis enden`
}

function ownMatchDetail(item: {
  focusResult: 'win' | 'draw' | 'loss'
  homeAway: 'H' | 'A'
  minGoalDiff?: number | null
}): string {
  const side = item.homeAway === 'H' ? 'Heim' : 'Auswärts'
  const base = `${focusResultLabel(item.focusResult)} · ${side}`
  const gd = item.minGoalDiff
  if (gd == null || gd <= 0 || item.focusResult === 'draw') return base
  if (item.focusResult === 'win') {
    return gd <= 1
      ? `${base} · 1:0 reicht`
      : `${base} · mit ausreichender Tordifferenz (mind. TD +${gd}, z. B. ${gd}:0)`
  }
  return gd <= 1
    ? `${base} · 0:1`
    : `${base} · mit ausreichender Tordifferenz (mind. TD −${gd}, z. B. 0:${gd})`
}

function ConditionsPanel({
  kind,
  targetRank,
  conditions,
  focusTeam,
  ownOptions,
  onApply,
  onExplain,
  onClose,
}: {
  kind: 'best' | 'worst' | 'target'
  targetRank: number
  conditions: CaseConditions
  focusTeam?: StandingRow | null
  ownOptions?: TargetOwnOption[]
  onApply?: (conditions: CaseConditions) => void
  onExplain?: (topic: ExplainTopic) => void
  onClose: () => void
}) {
  const [flexOpen, setFlexOpen] = useState(false)
  const heuristic = conditions.mode === 'heuristic'
  const caseLabel =
    kind === 'best' ? 'Bestfall' : kind === 'worst' ? 'Schlechtfall' : 'Wunschplatz'
  const heading = heuristic
    ? `${caseLabel}: Platz ${targetRank}`
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

      {heuristic && (
        <p className="conditions-heuristic-banner" role="note">
          Grobe Richtung, nicht exakt — bis zur Frontier-Enumeration keine „muss“-/Exakt-Aussage
          für die Saison.
        </p>
      )}

      {!heuristic &&
        conditions.ownMatch?.minGoalDiff != null &&
        conditions.ownMatch.minGoalDiff > 1 && (
          <p className="conditions-heuristic-banner" role="note">
            Reihenfolge entscheidet sich über die Tordifferenz — {caseLabel} braucht mehr als
            ein knappes 1:0.
          </p>
        )}

      <div className="conditions-block block-own">
        <h4>Deine Vorgabe</h4>
        {ownItems.length === 0 ? (
          <p className="hint tight">Kein eigenes Spiel in dieser Sicht.</p>
        ) : (
          <ul className="conditions-list crest-list">
            {ownItems.map((item) => {
              const focusName =
                focusTeam?.shortName || focusTeam?.teamName || 'Dein Team'
              const focusIcon = focusTeam?.teamIconUrl ?? ''
              const homeName = item.homeAway === 'H' ? focusName : item.opponentName
              const awayName = item.homeAway === 'H' ? item.opponentName : focusName
              const homeIcon =
                item.homeAway === 'H' ? focusIcon : item.opponentIconUrl
              const awayIcon =
                item.homeAway === 'H' ? item.opponentIconUrl : focusIcon
              return (
                <li key={item.matchId}>
                  <FixtureCrestRow
                    homeName={homeName}
                    awayName={awayName}
                    homeIconUrl={homeIcon}
                    awayIconUrl={awayIcon}
                    detail={ownMatchDetail(item)}
                  />
                </li>
              )
            })}
          </ul>
        )}
        {ownOptions && ownOptions.length > 0 && (
          <ul className="conditions-own-options">
            {ownOptions.map((o) => (
              <li key={o.focusResult}>{o.label}</li>
            ))}
          </ul>
        )}
        {heuristic && conditions.ownRest.length > 1 && (
          <p className="hint tight">Alle eigenen Restspiele als Richtung (nicht fest).</p>
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
                  ? 'Diese Teams liegen in Reichweite — ihre Patzer helfen der groben Bestfall-Richtung.'
                  : kind === 'worst'
                    ? 'Diese Teams können dich noch überholen — ihre Erfolge belasten die grobe Schlechtfall-Richtung.'
                    : 'Konkurrenten in Reichweite deines Wunschplatzes (grobe Richtung).'}
              </p>
              <ul className="conditions-list crest-list">
                {conditions.relevantRivals.map((r) => (
                  <li key={r.teamId} className="rival-crest-row">
                    <Crest url={r.teamIconUrl} name={r.teamName} size={24} />
                    <span>
                      {r.teamName}
                      <span className="conditions-meta">
                        {' '}
                        · Platz {r.rank} · {r.points} Pkt.
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : conditions.required.length === 0 ? (
          <p className="hint tight">
            {kind === 'target'
              ? 'Nur dein eigenes Ergebnis ist für diesen Wunschplatz fest.'
              : kind === 'best'
                ? 'Nur dein eigenes Ergebnis zählt für den Bestfall.'
                : 'Nur dein eigenes Ergebnis zählt für den Schlechtfall.'}
          </p>
        ) : (
          <ul className="conditions-list crest-list">
            {conditions.required.map((r) => (
              <li key={r.matchId}>
                <FixtureCrestRow
                  homeName={r.homeName}
                  awayName={r.awayName}
                  homeIconUrl={r.homeIconUrl}
                  awayIconUrl={r.awayIconUrl}
                  outcome={r.outcome}
                  detail={foreignOutcomeLine(r.homeName, r.awayName, r.outcome)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!heuristic && (
        <div className="conditions-block block-partial">
          <h4>Darf nicht</h4>
          {conditions.partiallyConstrained.length === 0 ? (
            <p className="hint tight">Kein Spiel mit genau einem verbotenen Ausgang.</p>
          ) : (
            <>
              <p className="hint tight">
                Zwei Ausgänge bleiben möglich — einer ist ausgeschlossen.
              </p>
              <ul className="conditions-list crest-list">
                {conditions.partiallyConstrained.map((p) => (
                  <li key={p.matchId}>
                    <FixtureCrestRow
                      homeName={p.homeName}
                      awayName={p.awayName}
                      homeIconUrl={p.homeIconUrl}
                      awayIconUrl={p.awayIconUrl}
                      detail={forbiddenOutcomeLine(
                        p.homeName,
                        p.awayName,
                        p.forbiddenOutcome,
                      )}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="conditions-block block-flex">
        <h4>{heuristic ? 'Ohne Einfluss' : 'Wirklich egal'}</h4>
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
                ? 'ohne Einfluss (Schätzung)'
                : `wirklich egal für den ${caseLabel}`}
              {flexOpen ? ' ▾' : ' ▸'}
            </button>
            {flexOpen && (
              <ul className="conditions-list crest-list muted">
                {conditions.flexible.map((f) => (
                  <li key={f.matchId}>
                    <FixtureCrestRow
                      homeName={f.homeName}
                      awayName={f.awayName}
                      homeIconUrl={f.homeIconUrl}
                      awayIconUrl={f.awayIconUrl}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {!heuristic && (
        <p className="hint tight conditions-disclaimer">
          Nicht jede Kombination der offenen Spiele führt zum selben Rang — im Simulator prüfbar.
        </p>
      )}

      {canApply && (
        <div className="conditions-actions">
          <button
            type="button"
            className="primary-action"
            onClick={() => onApply?.(conditions)}
          >
            Als Szenario übernehmen
          </button>
          {heuristic && (
            <p className="hint tight">
              Übernimmt nur deine Restspiel-Richtung — Fremdspiele bleiben offen.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TargetWishBlock({
  scopeLabel,
  outlook,
  leagueSize,
  targetRank,
  comparator,
  onTargetRankChange,
  onComparatorChange,
  focusTeam,
  onApplyConditions,
  onExplain,
  showSimPercents = true,
}: {
  scopeLabel: string
  outlook: TargetOutlook | null | undefined
  leagueSize: number
  targetRank: number
  comparator: TargetComparator
  onTargetRankChange: (rank: number) => void
  onComparatorChange: (c: TargetComparator) => void
  focusTeam: StandingRow
  onApplyConditions?: (conditions: CaseConditions) => void
  onExplain?: (topic: ExplainTopic) => void
  showSimPercents?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ranks = useMemo(
    () => Array.from({ length: leagueSize }, (_, i) => i + 1),
    [leagueSize],
  )

  const unreachableHint =
    outlook && !outlook.reachable
      ? `Platz ${outlook.target} ist ${
          scopeLabel === 'Spieltag' ? 'diesen Spieltag' : 'diese Saison'
        } nicht drin — machbar wäre ${
          comparator === 'atLeast' ? 'frühestens' : 'am ehesten'
        } Platz ${outlook.nearestReachable ?? '–'}.`
      : null

  return (
    <div className="target-wish">
      <div className="target-wish-controls">
        <label className="target-wish-label">
          Wunschplatz
          <select
            value={targetRank}
            onChange={(e) => onTargetRankChange(Number(e.target.value))}
            aria-label={`Wunschplatz ${scopeLabel}`}
          >
            {ranks.map((r) => (
              <option key={r} value={r}>
                {r}.
              </option>
            ))}
          </select>
        </label>
        <div className="segmented target-comparator" role="group" aria-label="Vergleich">
          <button
            type="button"
            className={comparator === 'exact' ? 'active' : ''}
            onClick={() => onComparatorChange('exact')}
          >
            genau
          </button>
          <button
            type="button"
            className={comparator === 'atLeast' ? 'active' : ''}
            onClick={() => onComparatorChange('atLeast')}
          >
            oder besser
          </button>
        </div>
      </div>

      {unreachableHint && (
        <p className="hint tight target-unreachable" role="status">
          {unreachableHint}
        </p>
      )}

      {outlook?.reachable && outlook.season && showSimPercents && (
        <div className="target-season-stats">
          <p className="hint tight">
            Sim: genau Platz {outlook.target}{' '}
            <strong>{Math.round(outlook.season.pExact * 100)}%</strong>
            {' · '}
            Platz {outlook.target} oder besser{' '}
            <strong>{Math.round(outlook.season.pAtLeast * 100)}%</strong>
          </p>
          {outlook.season.medianPoints != null && (
            <p className="hint tight">
              In Ziel-Läufen im Schnitt ~{Math.round(outlook.season.medianPoints)}{' '}
              Punkte
              {outlook.season.pointsNeeded != null && outlook.season.pointsNeeded > 0
                ? ` — noch ~${Math.round(outlook.season.pointsNeeded)}`
                : ''}
              .
            </p>
          )}
        </div>
      )}
      {outlook?.reachable && outlook.season && !showSimPercents && (
        <p className="hint tight" role="status">
          Sim-Prozente: noch keine Aussage (zu wenige Spiele).
        </p>
      )}

      {outlook?.reachable && outlook.conditions && (
        <>
          <button
            type="button"
            className={`ghost target-open-btn${open ? ' is-open' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? 'Bedingungen ausblenden' : 'Was muss passieren?'}
          </button>
          {open && (
            <ConditionsPanel
              kind="target"
              targetRank={outlook.target}
              conditions={outlook.conditions}
              focusTeam={focusTeam}
              ownOptions={outlook.ownOptions}
              onApply={onApplyConditions}
              onExplain={onExplain}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

function VariantPanel({
  heading,
  range,
  hardRange,
  league,
  note,
  empty,
  emptyAction,
  onExplain,
  bestConditions,
  worstConditions,
  onApplyConditions,
  focusTeam,
  matchup,
  matchPredictionSlot,
  targetSlot,
}: {
  heading: string
  range: PositionRange | null
  /** Äußere mathematische Garantie (Punktemaxima) — Zusatz unter der Spanne */
  hardRange?: HardRange | null
  league: LeagueZoneId
  note?: string
  empty?: string
  emptyAction?: ReactNode
  onExplain?: (topic: ExplainTopic) => void
  bestConditions?: CaseConditions | null
  worstConditions?: CaseConditions | null
  onApplyConditions?: (conditions: CaseConditions) => void
  focusTeam?: StandingRow | null
  matchup?: {
    opponentName: string
    opponentIconUrl: string | null
    homeAway: 'H' | 'A'
    matchday: number
  } | null
  matchPredictionSlot?: ReactNode
  targetSlot?: ReactNode
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

  const focusName = focusTeam?.shortName || focusTeam?.teamName || 'Du'
  // Immer echte Spielordnung: links Heim, rechts Auswärts
  const homeIsFocus = matchup?.homeAway === 'H'
  const homeName = homeIsFocus ? focusName : (matchup?.opponentName ?? '')
  const awayName = homeIsFocus ? (matchup?.opponentName ?? '') : focusName
  const homeIcon = homeIsFocus
    ? focusTeam?.teamIconUrl
    : matchup?.opponentIconUrl
  const awayIcon = homeIsFocus
    ? matchup?.opponentIconUrl
    : focusTeam?.teamIconUrl

  return (
    <div className={`panel insight-variant${matchup ? ' matchday-panel' : ''}`}>
      <div className="variant-head">
        <h2 className="variant-heading">{heading}</h2>
        {onExplain && range && (
          <ExplainLink topic="span" onExplain={onExplain} className="explain-inline" />
        )}
      </div>

      {matchup && focusTeam && (
        <div className="matchday-matchup" aria-label="Nächste Partie">
          <div className="matchup-side">
            <Crest url={homeIcon} name={homeName} size={48} />
            <span className="matchup-name">{homeName}</span>
            <span className="matchup-badge">Heim</span>
          </div>
          <div className="matchup-center">
            <span className="matchup-vs">vs</span>
            <span className="matchup-meta">
              {matchup.homeAway === 'H' ? 'Heimspiel' : 'Auswärtsspiel'} · ST{' '}
              {matchup.matchday}
            </span>
          </div>
          <div className="matchup-side">
            <Crest url={awayIcon} name={awayName} size={48} />
            <span className="matchup-name">{awayName}</span>
            <span className="matchup-badge matchup-badge-away">Auswärts</span>
          </div>
        </div>
      )}

      {matchPredictionSlot}

      {range ? (
        <>
          {matchup && (
            <p className="range-intro">
              Mögliche Platzierung nach diesem Spieltag — tippe für Bedingungen.
            </p>
          )}
          {hardRange && range.mode === 'exact' && (
            <p className="range-guarantee" role="status">
              Noch möglich (Obergrenze):{' '}
              <strong>
                {hardRange.hardBest}.–{hardRange.hardWorst}.
              </strong>
              {(hardRange.hardBest !== range.bestRank ||
                hardRange.hardWorst !== range.worstRank) && (
                <>
                  {' '}
                  <span className="range-guarantee-meta">
                    (weiter als die exakte Spanne darunter)
                  </span>
                </>
              )}
            </p>
          )}
          {range.mode === 'hard' && (
            <p className="range-mode-note" role="status">
              Sichere Obergrenze – kann mit weiteren Ergebnissen nur enger werden.
            </p>
          )}
          {range.mode === 'exact' && (
            <p className="range-mode-note" role="status">
              Genau berechnet.
            </p>
          )}
          <div className="range-card" role="group" aria-label="Best- und Schlechtfall">
            <button
              type="button"
              className={`range-side range-btn tone-best${openCase === 'best' ? ' is-open' : ''}${
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
                  {openCase === 'best' ? 'Bedingungen ausblenden' : 'Was muss passieren?'}
                </span>
              )}
            </button>
            <div className="divider" />
            <button
              type="button"
              className={`range-side range-btn tone-worst${openCase === 'worst' ? ' is-open' : ''}${
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
                  {openCase === 'worst' ? 'Bedingungen ausblenden' : 'Was muss passieren?'}
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
                focusTeam={focusTeam}
                onApply={onApplyConditions}
                onExplain={onExplain}
                onClose={() => setOpenCase(null)}
              />
            </div>
          )}

          {targetSlot && (
            <Disclosure
              closedLabel="Wunschplatz anzeigen"
              openLabel="Wunschplatz ausblenden"
            >
              {targetSlot}
            </Disclosure>
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
  matchdayTargetOutlook = null,
  forecastReliable = true,
  forecast = null,
  forecastLoading = false,
  matchdayOutlookLoading = false,
  matchdayTargetRank,
  matchdayTargetComparator,
  onMatchdayTargetRankChange,
  onMatchdayTargetComparatorChange,
  remainingCount,
  league,
  pointsToFirst,
  pointsAboveRelegation,
  onEnableMatchdayCutoff,
  suggestedCutoff,
  scheduleHardness = null,
  teamTrend = null,
  leagueTeamCount = 18,
  standings = [],
  openMatches = [],
  playedMatches = [],
  scenarios = [],
  onExplain,
  onApplyConditions,
  onOpenDecisions,
  decisionRow = null,
  decisionHasLive = false,
  decisionNextMatchday = null,
}: Props) {
  const ownNextMatch = useMemo(() => {
    if (!team || !nextMatchday?.plays) return null
    return (
      openMatches.find(
        (m) =>
          m.group.groupOrderID === nextMatchday.matchday &&
          (m.team1.teamId === team.teamId || m.team2.teamId === team.teamId),
      ) ?? null
    )
  }, [openMatches, nextMatchday, team])

  const ownMatchPrediction = useMemo(() => {
    if (!ownNextMatch || standings.length === 0) return null
    return predictFixture(standings, ownNextMatch, { scenarios, playedMatches })
  }, [standings, ownNextMatch, scenarios, playedMatches])

  const remainingFixtures = useMemo(() => {
    if (!team) return []
    return openMatches
      .filter(
        (m) =>
          m.team1.teamId === team.teamId || m.team2.teamId === team.teamId,
      )
      .sort(
        (a, b) =>
          a.group.groupOrderID - b.group.groupOrderID || a.matchID - b.matchID,
      )
  }, [openMatches, team])

  const remainingLeans = useMemo(() => {
    const map = new Map<number, ReturnType<typeof deriveMatchLean>>()
    if (!team || standings.length === 0) return map
    for (const m of remainingFixtures) {
      const pred = predictFixture(standings, m, { scenarios, playedMatches })
      if (!pred) continue
      const perspective =
        m.team1.teamId === team.teamId ? ('home' as const) : ('away' as const)
      map.set(m.matchID, deriveMatchLean(pred, perspective))
    }
    return map
  }, [remainingFixtures, standings, scenarios, playedMatches, team])

  if (!team) {
    return (
      <div className="panel insight">
        <h2>Verein</h2>
        <p className="hint">
          Verein in der Tabelle wählen – dann siehst du Überblick, nächsten Spieltag und
          Saison.
        </p>
      </div>
    )
  }

  const hardnessGradeValue =
    scheduleHardness &&
    scheduleHardness.remainingGames > 0 &&
    scheduleHardness.reliable
      ? scheduleHardness.grade
      : null
  const clubShort = team.shortName || team.teamName
  const hardnessLabel =
    hardnessGradeValue != null
      ? hardnessGradeLabelForClub(hardnessGradeValue, clubShort)
      : null

  const matchup =
    nextMatchday?.plays &&
    nextMatchday.opponentName &&
    nextMatchday.homeAway
      ? {
          opponentName: nextMatchday.opponentName,
          opponentIconUrl: nextMatchday.opponentIconUrl,
          homeAway: nextMatchday.homeAway,
          matchday: nextMatchday.matchday,
        }
      : null

  const relegCutoff = relegationCutoffRank(league)
  const goalDiffLabel =
    team.goalDiff > 0 ? `+${team.goalDiff}` : String(team.goalDiff)

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
              Platz {team.rank} · {team.points} Pkt. · Tordiff. {goalDiffLabel} ·{' '}
              {team.won}S {team.draw}U {team.lost}N · {remainingCount} Restspiele
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
              <span className="label">Vorsprung Platz {relegCutoff}</span>
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
              {scheduleHardness.reliable && hardnessLabel ? (
                <>
                  <strong className={`hardness-stat tone-${hardnessGradeValue}`}>
                    {hardnessLabel}
                  </strong>
                  <span className="hardness-stat-meta">
                    Wie schwer das Restprogramm für diesen Verein ist ·
                    Modellschätzung
                  </span>
                </>
              ) : (
                <strong className="hardness-stat tone-pending">
                  noch keine Aussage
                  <span className="hardness-stat-meta"> (zu wenige Spiele)</span>
                </strong>
              )}
            </div>
          )}
          <div>
            <span className="label">
              Form-Trend
              {onExplain && (
                <>
                  {' '}
                  <ExplainLink
                    topic="trend"
                    onExplain={onExplain}
                    className="explain-inline"
                  >
                    Erklärung
                  </ExplainLink>
                </>
              )}
            </span>
            <TrendBadge trend={teamTrend} onExplain={onExplain} />
          </div>
        </div>

        <ForecastZoneBreakdown
          forecast={forecast}
          loading={forecastLoading}
          reliable={forecastReliable}
          league={league}
          onExplain={onExplain}
        />

        {remainingFixtures.length > 0 && (
          <Disclosure
            closedLabel={`Restprogramm (${remainingFixtures.length} ${
              remainingFixtures.length === 1 ? 'Spiel' : 'Spiele'
            }) anzeigen`}
            openLabel="Restprogramm ausblenden"
          >
            <p className="hint tight insight-remaining-hint">
              Je Gegner der wahrscheinlichste Ausgang (Vereinssicht)
              {onExplain && (
                <>
                  {' '}
                  <ExplainLink
                    topic="matchLean"
                    onExplain={onExplain}
                    className="explain-inline"
                  >
                    Einschätzung erklären
                  </ExplainLink>
                </>
              )}
              .
            </p>
            <ul className="insight-remaining">
              {remainingFixtures.map((m) => {
                const home = m.team1.teamId === team.teamId
                const opp = home ? m.team2 : m.team1
                const lean = remainingLeans.get(m.matchID) ?? null
                return (
                  <li key={m.matchID}>
                    <span className="md">ST {m.group.groupOrderID}</span>
                    <span className={`venue venue-${home ? 'H' : 'A'}`}>
                      {home ? 'H' : 'A'}
                    </span>
                    <span className="opp">{opp.shortName || opp.teamName}</span>
                    <MatchLeanChip lean={lean} compact />
                  </li>
                )
              })}
            </ul>
          </Disclosure>
        )}
      </div>

      <VariantPanel
        heading={
          nextMatchday
            ? `${nextMatchday.matchday}. Spieltag`
            : 'Nächster Spieltag'
        }
        range={nextMatchday?.range ?? null}
        hardRange={nextMatchday?.hardRange ?? null}
        league={league}
        focusTeam={team}
        matchup={matchup}
        matchPredictionSlot={
          ownMatchPrediction && matchup ? (
            <MatchPredictionCard
              prediction={ownMatchPrediction}
              perspective="neutral"
              title={
                matchup.homeAway === 'H'
                  ? `Spielschätzung · ${team.shortName || team.teamName} – ${matchup.opponentName}`
                  : `Spielschätzung · ${matchup.opponentName} – ${team.shortName || team.teamName}`
              }
              homeName={
                matchup.homeAway === 'H'
                  ? team.shortName || team.teamName
                  : matchup.opponentName
              }
              awayName={
                matchup.homeAway === 'A'
                  ? team.shortName || team.teamName
                  : matchup.opponentName
              }
              onExplain={onExplain}
            />
          ) : null
        }
        onExplain={onExplain}
        bestConditions={nextMatchday?.bestConditions ?? null}
        worstConditions={nextMatchday?.worstConditions ?? null}
        onApplyConditions={onApplyConditions}
        targetSlot={
          <TargetWishBlock
            scopeLabel="Spieltag"
            outlook={matchdayTargetOutlook}
            leagueSize={leagueTeamCount}
            targetRank={matchdayTargetRank}
            comparator={matchdayTargetComparator}
            onTargetRankChange={onMatchdayTargetRankChange}
            onComparatorChange={onMatchdayTargetComparatorChange}
            focusTeam={team}
            onApplyConditions={onApplyConditions}
            onExplain={onExplain}
          />
        }
        note={
          matchdayOutlookLoading
            ? 'Spieltag-Analyse wird berechnet…'
            : nextMatchday && !nextMatchday.plays
              ? 'Kein eigenes Spiel an diesem Spieltag — trotzdem relevant über Fremdergebnisse.'
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
        hardRange={seasonOutlook?.hardRange ?? null}
        league={league}
        focusTeam={team}
        onExplain={onExplain}
        note={
          seasonOutlook?.range
            ? seasonOutlook.range.bestRank === seasonOutlook.range.worstRank
              ? 'Platz über die Restspiele in dieser Sicht bereits fest.'
              : seasonOutlook.range.mode === 'exact'
                ? 'Genau berechnete Endplätze über die noch entscheidenden Restspiele. Keine „was muss passieren?“-Liste für die Saison.'
                : 'Noch mögliche Endplätze (sichere Obergrenze). Keine „was muss passieren?“-Liste für die Saison.'
            : undefined
        }
        empty="Keine Saison-Spanne berechenbar."
      />

      {decisionRow && (
        <DecisionInsightBlock
          row={decisionRow}
          useLive={decisionHasLive}
          nextMatchday={decisionNextMatchday}
          onExplain={onExplain}
          onOpenDecisions={onOpenDecisions}
        />
      )}
    </div>
  )
}
