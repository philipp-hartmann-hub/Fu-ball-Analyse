import type { LeagueZoneId } from './table'
import { zoneForRank } from './table'

export interface PointRankOutcome {
  points: number
  rank: number
}

export interface ThresholdLine {
  key: string
  label: string
  primary: string
  secondary?: string
  /** guter / kritischer / neutraler Hinweis */
  tone: 'good' | 'bad' | 'neutral'
}

export type ThresholdHorizon = 'matchday' | 'season'

export interface DeriveThresholdOptions {
  exact: boolean
  /**
   * Max. erreichbare Punkte im betrachteten Horizont
   * (Spieltag: currentPoints + 0/3). Schwellen darüber werden verworfen.
   */
  reachableMax?: number
  /** Steuert Label-Formulierungen (Spieltag vs. Saison). */
  horizon?: ThresholdHorizon
}

export function isRelegationRank(rank: number, league: LeagueZoneId): boolean {
  const z = zoneForRank(rank, league)
  return z === 'relegation' || z === 'direct-relegation'
}

/** BL1: CL-Plätze 1–4; BL2: Direktaufstieg 1–2 */
export function isTopTargetRank(rank: number, league: LeagueZoneId): boolean {
  if (league === 'bl2') return rank <= 2
  return rank <= 4
}

export function topTargetLabel(league: LeagueZoneId): string {
  return league === 'bl2' ? 'Aufstieg' : 'CL'
}

function neededPoints(threshold: number, currentPoints: number): string | undefined {
  const need = threshold - currentPoints
  if (need > 0) return `noch ${need} Pkt.`
  if (need === 0) return 'Schwelle erreicht'
  return `bereits ${-need} Pkt. über der Schwelle`
}

function withinReach(threshold: number, reachableMax: number | undefined): boolean {
  if (reachableMax == null) return true
  return threshold <= reachableMax
}

function matchdayLabel(base: string, horizon: ThresholdHorizon): string {
  if (horizon !== 'matchday') return base
  return `Nach Spieltag: ${base}`
}

/**
 * Qualitative Zeilen aus Best-/Schlechtfall (Zwei-Punkt-Heuristik / Saison).
 * Keine „ab X Pkt.“-Zahlen — die wären aus zwei Extrempunkten Artefakte.
 */
function qualitativeFromExtremes(
  outcomes: PointRankOutcome[],
  league: LeagueZoneId,
  withTag: (s: string) => string,
): ThresholdLine[] {
  const canRelegate = outcomes.some((o) => isRelegationRank(o.rank, league))
  const canSurvive = outcomes.some((o) => !isRelegationRank(o.rank, league))
  const canReachTarget = outcomes.some((o) => isTopTargetRank(o.rank, league))
  const targetCertain = outcomes.every((o) => isTopTargetRank(o.rank, league))
  const goalName = topTargetLabel(league)

  // Ziel und Abstieg beide noch möglich → nichts Entscheidendes sagbar
  if (canReachTarget && canRelegate) return []

  const lines: ThresholdLine[] = []

  if (!canRelegate && canSurvive) {
    lines.push({
      key: 'survive-safe',
      label: 'Klassenerhalt',
      primary: withTag('rechnerisch sicher'),
      tone: 'good',
    })
  } else if (!canSurvive && canRelegate) {
    lines.push({
      key: 'releg-certain',
      label: 'Abstieg',
      primary: withTag('nicht mehr abwendbar'),
      tone: 'bad',
    })
  }

  if (!canReachTarget) {
    lines.push({
      key: 'target-gone',
      label: goalName,
      primary: withTag('nicht mehr erreichbar'),
      tone: 'bad',
    })
  } else if (targetCertain) {
    lines.push({
      key: 'target-safe',
      label: goalName,
      primary: withTag('rechnerisch sicher'),
      tone: 'good',
    })
  }

  return lines
}

/**
 * Exakte Enumeration (Spieltag): Punkt-Schwellen nur wenn etwas greifbar ist.
 * Regime: Ziel und Abstieg beide noch möglich → keine Punkt-Schwellen.
 */
function exactThresholdLines(
  outcomes: PointRankOutcome[],
  currentPoints: number,
  currentRank: number,
  league: LeagueZoneId,
  options: DeriveThresholdOptions,
): ThresholdLine[] {
  const horizon = options.horizon ?? 'matchday'
  const reachableMax = options.reachableMax

  const releg = outcomes.filter((o) => isRelegationRank(o.rank, league))
  const safe = outcomes.filter((o) => !isRelegationRank(o.rank, league))
  const target = outcomes.filter((o) => isTopTargetRank(o.rank, league))
  const missTarget = outcomes.filter((o) => !isTopTargetRank(o.rank, league))

  const canRelegate = releg.length > 0
  const canSurvive = safe.length > 0
  const canReachTarget = target.length > 0
  const targetCertain = missTarget.length === 0

  const showSurvival =
    currentRank >= 8 ||
    canRelegate ||
    !canSurvive ||
    isRelegationRank(currentRank, league)
  const showTarget =
    currentRank <= 10 ||
    canReachTarget ||
    isTopTargetRank(currentRank, league) ||
    (!canReachTarget && currentRank <= 12)

  const goalName = topTargetLabel(league)
  const lines: ThresholdLine[] = []

  // Offenes Regime: Ziel und Abstieg beide möglich → gar keine Punkt-Schwellen
  // (bei Saisonstart typisch: nichts ist entschieden).
  if (canReachTarget && canRelegate) {
    return []
  }

  if (showSurvival) {
    if (!canRelegate) {
      lines.push({
        key: 'survive-safe',
        label: matchdayLabel('Klassenerhalt', horizon),
        primary: 'rechnerisch sicher',
        tone: 'good',
      })
    } else if (!canSurvive) {
      lines.push({
        key: 'releg-certain',
        label: matchdayLabel('Abstieg', horizon),
        primary: 'nicht mehr abwendbar',
        tone: 'bad',
      })
    } else {
      const maxPtsReleg = Math.max(...releg.map((o) => o.points))
      const safeFrom = maxPtsReleg + 1
      if (withinReach(safeFrom, reachableMax)) {
        lines.push({
          key: 'survive-from',
          label: matchdayLabel('Klassenerhalt ab', horizon),
          primary: `${safeFrom} Pkt.`,
          secondary: neededPoints(safeFrom, currentPoints),
          tone: 'neutral',
        })
      }
    }
  }

  if (showTarget) {
    if (!canReachTarget) {
      lines.push({
        key: 'target-gone',
        label: matchdayLabel(goalName, horizon),
        primary: 'nicht mehr erreichbar',
        tone: 'bad',
      })
    } else if (targetCertain) {
      lines.push({
        key: 'target-safe',
        label: matchdayLabel(goalName, horizon),
        primary: 'rechnerisch sicher',
        tone: 'good',
      })
    } else {
      const maxPtsMiss = Math.max(...missTarget.map((o) => o.points))
      const safeFrom = maxPtsMiss + 1
      const minPtsTarget = Math.min(...target.map((o) => o.points))

      if (withinReach(safeFrom, reachableMax)) {
        lines.push({
          key: 'target-secure-from',
          label: matchdayLabel(`${goalName} sicher ab`, horizon),
          primary: `${safeFrom} Pkt.`,
          secondary: neededPoints(safeFrom, currentPoints),
          tone: 'good',
        })
      }
      if (withinReach(minPtsTarget, reachableMax)) {
        lines.push({
          key: 'target-possible-from',
          label: matchdayLabel(`${goalName} möglich ab`, horizon),
          primary: `${minPtsTarget} Pkt.`,
          secondary: neededPoints(minPtsTarget, currentPoints),
          tone: 'neutral',
        })
      }
    }
  }

  return lines
}

/**
 * Leitet Schwellen aus Outcome-Liste ab.
 *
 * - exact=false (Saison-Heuristik mit Best/Worst): nur qualitative Aussagen,
 *   keine „ab X Pkt.“-Zahlen. Wenn Ziel und Abstieg beide möglich → [].
 * - exact=true (Spieltag-Enumeration): Punkt-Schwellen mit reachableMax-Filter;
 *   offenes Regime (Ziel ∧ Abstieg) → keine Punkt-Schwellen.
 */
export function deriveThresholdLines(
  outcomes: PointRankOutcome[],
  currentPoints: number,
  currentRank: number,
  league: LeagueZoneId,
  options: DeriveThresholdOptions = { exact: true },
): ThresholdLine[] {
  if (!outcomes.length) return []

  const tag = options.exact ? undefined : 'Schätzung'
  const withTag = (s: string) => (tag ? `${s} (${tag})` : s)

  if (!options.exact) {
    return qualitativeFromExtremes(outcomes, league, withTag)
  }

  return exactThresholdLines(
    outcomes,
    currentPoints,
    currentRank,
    league,
    options,
  )
}
