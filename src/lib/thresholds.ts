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

/**
 * Leitet Schwellen aus Outcome-Liste ab.
 * exact=false → Labels mit „Schätzung“ kennzeichnen.
 */
export function deriveThresholdLines(
  outcomes: PointRankOutcome[],
  currentPoints: number,
  currentRank: number,
  league: LeagueZoneId,
  options: { exact: boolean } = { exact: true },
): ThresholdLine[] {
  if (!outcomes.length) return []

  const tag = options.exact ? undefined : 'Schätzung'
  const withTag = (s: string) => (tag ? `${s} (${tag})` : s)

  const releg = outcomes.filter((o) => isRelegationRank(o.rank, league))
  const safe = outcomes.filter((o) => !isRelegationRank(o.rank, league))
  const target = outcomes.filter((o) => isTopTargetRank(o.rank, league))
  const missTarget = outcomes.filter((o) => !isTopTargetRank(o.rank, league))

  const canRelegate = releg.length > 0
  const canSurvive = safe.length > 0
  const canReachTarget = target.length > 0
  const targetCertain = missTarget.length === 0

  const showSurvival =
    currentRank >= 8 || canRelegate || !canSurvive || isRelegationRank(currentRank, league)
  const showTarget =
    currentRank <= 10 ||
    canReachTarget ||
    isTopTargetRank(currentRank, league) ||
    (!canReachTarget && currentRank <= 12)

  const lines: ThresholdLine[] = []
  const goalName = topTargetLabel(league)

  if (showSurvival) {
    if (!canRelegate) {
      lines.push({
        key: 'survive-safe',
        label: 'Klassenerhalt',
        primary: withTag('rechnerisch sicher'),
        tone: 'good',
      })
    } else if (!canSurvive) {
      lines.push({
        key: 'releg-certain',
        label: 'Abstieg',
        primary: withTag('nicht mehr abwendbar'),
        tone: 'bad',
      })
    } else {
      const maxPtsReleg = Math.max(...releg.map((o) => o.points))
      const safeFrom = maxPtsReleg + 1
      lines.push({
        key: 'survive-from',
        label: 'Sicherer Klassenerhalt ab',
        primary: withTag(`${safeFrom} Pkt.`),
        secondary: neededPoints(safeFrom, currentPoints),
        tone: 'neutral',
      })
    }
  }

  if (showTarget) {
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
        label: `${goalName} sicher`,
        primary: withTag('rechnerisch sicher'),
        tone: 'good',
      })
    } else {
      const maxPtsMiss = Math.max(...missTarget.map((o) => o.points))
      const safeFrom = maxPtsMiss + 1
      const minPtsTarget = Math.min(...target.map((o) => o.points))
      lines.push({
        key: 'target-secure-from',
        label: `${goalName} sicher ab`,
        primary: withTag(`${safeFrom} Pkt.`),
        secondary: neededPoints(safeFrom, currentPoints),
        tone: 'good',
      })
      lines.push({
        key: 'target-possible-from',
        label: `${goalName} nur möglich ab`,
        primary: withTag(`${minPtsTarget} Pkt.`),
        secondary: neededPoints(minPtsTarget, currentPoints),
        tone: 'neutral',
      })
    }
  }

  return lines
}
