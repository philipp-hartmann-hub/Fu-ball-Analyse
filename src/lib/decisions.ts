import type { HardRange, Match, PositionRange, StandingRow } from '../types'
import type { MatchScore } from './table'
import { MATCHDAY_DISPLAY_HOLD_MS } from './live'
import {
  computeHardBounds,
  computeHardRanges,
  computePositionRanges,
  enumerateMatchdayOutcomesByTeam,
  matchesOnMatchday,
  nextOpenMatchday,
  seasonExtremeOutcomes,
} from './scenarios'
import {
  deriveThresholdLines,
  isRelegationRank,
  isTopTargetRank,
  topTargetLabel,
  topTargetPlaceLabel,
  type PointRankOutcome,
  type ThresholdLine,
} from './thresholds'
import { zoneForRank, zoneLabelFor, type LeagueZoneId } from './table'

/** Feststehender Status aus harten Grenzen — immer eine Saison-Aussage. */
export type DecisionStatusKind =
  | 'champion'
  | 'title_secure'
  | 'title_gone'
  | 'safe'
  | 'relegated'

export interface DecisionStatus {
  kind: DecisionStatusKind
  /** Kurzname ohne Horizont, z. B. „Gerettet“ */
  shortLabel: string
  /** UI-Label mit Saison-Klarstellung */
  label: string
  tone: 'good' | 'bad' | 'neutral'
}

export type DecisionDeltaKind = 'gained' | 'lost'

export interface DecisionDelta {
  kind: DecisionDeltaKind
  status: DecisionStatus
  /**
   * Spieltags-Auslöser, Saison-Konsequenz —
   * z. B. „Laufender Zwischenstand: für die Saison jetzt gerettet.“
   */
  message: string
}

export interface DecisionTeamRow {
  teamId: number
  teamName: string
  shortName: string
  teamIconUrl: string
  rank: number
  points: number
  confirmedHard: HardRange
  liveHard: HardRange
  range: PositionRange
  confirmedStatuses: DecisionStatus[]
  liveStatuses: DecisionStatus[]
  /** Nur wenn mind. ein Spiel live und Status sich ändert */
  deltas: DecisionDelta[]
  /** Saison-Horizont (oft Näherung) */
  seasonTriggers: ThresholdLine[]
  /** Spieltags-Horizont (exakt wenn Enumeration ≤12) */
  matchdayTriggers: ThresholdLine[]
  matchdayTriggersExact: boolean
}

export interface DecisionRadar {
  hasLive: boolean
  /**
   * Spieltags-Block zeigen, sobald Restspiele (nächster Spieltag) oder Live existieren.
   * Leer-Aussage statt den Block zu verstecken.
   */
  showMatchdayHorizon: boolean
  /** Nächster Spieltag steht im Anstoß-Fenster (für Banner-Text). */
  matchdayAtHand: boolean
  nextMatchday: number | null
  decided: DecisionTeamRow[]
  /** Live-Deltas und/oder Teams mit Auslöser-Hinweisen (ohne feststehenden Status) */
  pending: DecisionTeamRow[]
  all: DecisionTeamRow[]
}

function withSeasonLabel(shortLabel: string): string {
  return `${shortLabel} (Saison steht fest)`
}

export function deriveDecisionStatuses(
  hard: HardRange,
  league: LeagueZoneId,
): DecisionStatus[] {
  const out: DecisionStatus[] = []
  const { hardBest, hardWorst } = hard
  const goal = topTargetLabel(league)

  if (hardWorst === 1) {
    const shortLabel = league === 'bl1' ? 'Meister' : zoneLabelFor(1, league)
    out.push({
      kind: 'champion',
      shortLabel,
      label: withSeasonLabel(shortLabel),
      tone: 'good',
    })
  } else if (isTopTargetRank(hardWorst, league)) {
    const shortLabel = `${goal} sicher`
    out.push({
      kind: 'title_secure',
      shortLabel,
      label: withSeasonLabel(shortLabel),
      tone: 'good',
    })
  }

  if (!isTopTargetRank(hardBest, league) && hardWorst !== 1) {
    const shortLabel = `${goal} nicht mehr möglich`
    out.push({
      kind: 'title_gone',
      shortLabel,
      label: withSeasonLabel(shortLabel),
      tone: 'bad',
    })
  }

  if (isRelegationRank(hardBest, league)) {
    const shortLabel =
      zoneForRank(hardBest, league) === 'relegation'
        ? 'Relegation Abstieg fest'
        : 'Abgestiegen'
    out.push({
      kind: 'relegated',
      shortLabel,
      label: withSeasonLabel(shortLabel),
      tone: 'bad',
    })
  } else if (!isRelegationRank(hardWorst, league)) {
    out.push({
      kind: 'safe',
      shortLabel: 'Gerettet',
      label: withSeasonLabel('Gerettet'),
      tone: 'good',
    })
  }

  return out
}

function statusKey(s: DecisionStatus): DecisionStatusKind {
  return s.kind
}

export function diffDecisionStatuses(
  confirmed: DecisionStatus[],
  live: DecisionStatus[],
): DecisionDelta[] {
  const confKeys = new Set(confirmed.map(statusKey))
  const liveKeys = new Set(live.map(statusKey))
  const deltas: DecisionDelta[] = []

  for (const s of live) {
    if (!confKeys.has(s.kind)) {
      deltas.push({
        kind: 'gained',
        status: s,
        message: `Laufender Zwischenstand: für die Saison jetzt „${s.shortLabel}“.`,
      })
    }
  }
  for (const s of confirmed) {
    if (!liveKeys.has(s.kind)) {
      deltas.push({
        kind: 'lost',
        status: s,
        message:
          s.tone === 'good'
            ? `Laufender Zwischenstand: „${s.shortLabel}“ für die Saison nicht mehr sicher.`
            : `Laufender Zwischenstand: „${s.shortLabel}“ entfällt vorerst (Saison).`,
      })
    }
  }
  return deltas
}

function sortTriggers(lines: ThresholdLine[]): ThresholdLine[] {
  const preferred = [
    'survive-from',
    'survive-safe',
    'releg-certain',
    'target-secure-from',
    'target-safe',
    'target-gone',
    'target-possible-from',
  ]
  return [...lines].sort((a, b) => {
    const ia = preferred.indexOf(a.key)
    const ib = preferred.indexOf(b.key)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

/**
 * Schwellen, die der feststehende Status nicht schon sagt
 * (z. B. „CL möglich ab X“ obwohl schon gerettet).
 */
export function triggersBeyondStatus(
  statuses: DecisionStatus[],
  lines: ThresholdLine[],
): ThresholdLine[] {
  const kinds = new Set(statuses.map((s) => s.kind))
  return lines.filter((line) => {
    if (line.key === 'survive-safe' && kinds.has('safe')) return false
    if (line.key === 'releg-certain' && kinds.has('relegated')) return false
    if (
      line.key === 'target-safe' &&
      (kinds.has('title_secure') || kinds.has('champion'))
    ) {
      return false
    }
    if (line.key === 'target-gone' && kinds.has('title_gone')) return false
    return true
  })
}

/**
 * Saison-Ziel und Abstieg sind beide noch möglich — Spieltags-Zonen (Platz nach
 * 90 Minuten) wären keine Saison-Entscheidung.
 */
export function seasonFateStillOpen(
  hard: HardRange,
  league: LeagueZoneId,
): boolean {
  return (
    isTopTargetRank(hard.hardBest, league) &&
    isRelegationRank(hard.hardWorst, league)
  )
}

function seasonTargetOpen(hard: HardRange, league: LeagueZoneId): boolean {
  return (
    isTopTargetRank(hard.hardBest, league) &&
    !isTopTargetRank(hard.hardWorst, league)
  )
}

function seasonSurvivalOpen(hard: HardRange, league: LeagueZoneId): boolean {
  return (
    !isRelegationRank(hard.hardBest, league) &&
    isRelegationRank(hard.hardWorst, league)
  )
}

/**
 * Sound-Näherung: Fokus bekommt `focusGain` Punkte, alle Spieltags-Partien
 * entfallen ohne Punkte für die übrigen. Wenn selbst so die Saison-Zone nicht
 * kippt, kann kein realer Spieltagsausgang sie entscheiden.
 */
function hardAfterMatchdayFocusGain(
  standings: StandingRow[],
  remaining: Match[],
  matchday: number,
  teamId: number,
  focusGain: 0 | 1 | 3,
): HardRange | null {
  const afterFixtures = remaining.filter(
    (m) => m.group.groupOrderID !== matchday,
  )
  const next = standings.map((row) => {
    if (row.teamId !== teamId || focusGain === 0) return row
    return {
      ...row,
      points: row.points + focusGain,
      won: row.won + (focusGain === 3 ? 1 : 0),
      draw: row.draw + (focusGain === 1 ? 1 : 0),
      played: row.played + 1,
    }
  })
  return computeHardBounds(next, afterFixtures, teamId)
}

export function matchdayCanSecureTarget(
  standings: StandingRow[],
  remaining: Match[],
  matchday: number,
  teamId: number,
  league: LeagueZoneId,
): boolean {
  const hard = hardAfterMatchdayFocusGain(
    standings,
    remaining,
    matchday,
    teamId,
    3,
  )
  return hard != null && isTopTargetRank(hard.hardWorst, league)
}

export function matchdayCanEliminateTarget(
  standings: StandingRow[],
  remaining: Match[],
  matchday: number,
  teamId: number,
  league: LeagueZoneId,
): boolean {
  const hard = hardAfterMatchdayFocusGain(
    standings,
    remaining,
    matchday,
    teamId,
    0,
  )
  return hard != null && !isTopTargetRank(hard.hardBest, league)
}

export function matchdayCanSecureSurvival(
  standings: StandingRow[],
  remaining: Match[],
  matchday: number,
  teamId: number,
  league: LeagueZoneId,
): boolean {
  const hard = hardAfterMatchdayFocusGain(
    standings,
    remaining,
    matchday,
    teamId,
    3,
  )
  return hard != null && !isRelegationRank(hard.hardWorst, league)
}

export function matchdayCanForceRelegation(
  standings: StandingRow[],
  remaining: Match[],
  matchday: number,
  teamId: number,
  league: LeagueZoneId,
): boolean {
  const hard = hardAfterMatchdayFocusGain(
    standings,
    remaining,
    matchday,
    teamId,
    0,
  )
  return hard != null && isRelegationRank(hard.hardBest, league)
}

/**
 * Spieltags-Schwellen nur behalten, wenn die zugehörige Saison-Zone an der
 * harten Spanne (wie Möglich) noch offen ist und dieser Spieltag sie kippen kann.
 * `deriveThresholdLines` bleibt unverändert — nur Radar-Gating.
 */
export function filterMatchdayTriggersBySeasonHard(
  lines: ThresholdLine[],
  seasonHard: HardRange,
  league: LeagueZoneId,
  caps: {
    canSecureTarget: boolean
    canEliminateTarget: boolean
    canSecureSurvival: boolean
    canForceRelegation: boolean
  },
): ThresholdLine[] {
  const targetOpen = seasonTargetOpen(seasonHard, league)
  const survivalOpen = seasonSurvivalOpen(seasonHard, league)

  return lines.filter((line) => {
    switch (line.key) {
      case 'target-gone':
        return targetOpen && caps.canEliminateTarget
      case 'target-safe':
      case 'target-secure-from':
        return targetOpen && caps.canSecureTarget
      case 'target-possible-from':
        return (
          targetOpen && (caps.canSecureTarget || caps.canEliminateTarget)
        )
      case 'survive-safe':
      case 'survive-from':
        return survivalOpen && caps.canSecureSurvival
      case 'releg-certain':
        return survivalOpen && caps.canForceRelegation
      default:
        return false
    }
  })
}

/**
 * Saison-Zeilen dürfen der harten Spanne (Möglich) nie widersprechen.
 */
export function filterSeasonTriggersByHard(
  lines: ThresholdLine[],
  seasonHard: HardRange,
  league: LeagueZoneId,
): ThresholdLine[] {
  return lines.filter((line) => {
    switch (line.key) {
      case 'target-gone':
        return !isTopTargetRank(seasonHard.hardBest, league)
      case 'target-safe':
        return isTopTargetRank(seasonHard.hardWorst, league)
      case 'target-secure-from':
      case 'target-possible-from':
        return seasonTargetOpen(seasonHard, league)
      case 'survive-safe':
        return !isRelegationRank(seasonHard.hardWorst, league)
      case 'survive-from':
        return seasonSurvivalOpen(seasonHard, league)
      case 'releg-certain':
        return isRelegationRank(seasonHard.hardBest, league)
      default:
        return true
    }
  })
}

/**
 * Spieltags-Ebene: Tabellenplatz nach/an diesem Spieltag — nie Saison-Clinch-Sprache.
 */
export function deriveMatchdayPositionLines(
  outcomes: PointRankOutcome[],
  currentRank: number,
  league: LeagueZoneId,
  opts?: {
    hasLive?: boolean
    liveRank?: number
    confirmedRank?: number
  },
): ThresholdLine[] {
  const lines: ThresholdLine[] = []
  const placeName = topTargetPlaceLabel(league)

  if (opts?.hasLive && opts.liveRank != null && opts.confirmedRank != null) {
    if (opts.liveRank !== opts.confirmedRank) {
      lines.push({
        key: 'live-rank',
        label: 'Zwischenstand',
        primary: `jetzt Platz ${opts.liveRank}`,
        secondary:
          opts.liveRank < opts.confirmedRank
            ? `vorher ${opts.confirmedRank}.`
            : `vorher ${opts.confirmedRank}.`,
        tone: opts.liveRank < opts.confirmedRank ? 'good' : 'bad',
      })
    }
    const liveTarget = isTopTargetRank(opts.liveRank, league)
    const confTarget = isTopTargetRank(opts.confirmedRank, league)
    if (liveTarget && !confTarget) {
      lines.push({
        key: 'live-target',
        label: 'Zwischenstand',
        primary: `jetzt ${placeName}`,
        tone: 'good',
      })
    } else if (!liveTarget && confTarget) {
      lines.push({
        key: 'live-target-lost',
        label: 'Zwischenstand',
        primary: `nicht mehr ${placeName}`,
        tone: 'bad',
      })
    }
    const liveReleg = isRelegationRank(opts.liveRank, league)
    const confReleg = isRelegationRank(opts.confirmedRank, league)
    if (liveReleg && !confReleg) {
      lines.push({
        key: 'live-releg',
        label: 'Zwischenstand',
        primary: 'jetzt Abstiegsplatz',
        tone: 'bad',
      })
    } else if (!liveReleg && confReleg) {
      lines.push({
        key: 'live-releg-cleared',
        label: 'Zwischenstand',
        primary: 'kein Abstiegsplatz mehr',
        tone: 'good',
      })
    }
  }

  if (!outcomes.length) return lines

  const ranks = outcomes.map((o) => o.rank)
  const bestRank = Math.min(...ranks)
  const worstRank = Math.max(...ranks)
  const canTarget = outcomes.some((o) => isTopTargetRank(o.rank, league))
  const targetCertain = outcomes.every((o) => isTopTargetRank(o.rank, league))
  const canReleg = outcomes.some((o) => isRelegationRank(o.rank, league))
  const relegCertain = outcomes.every((o) => isRelegationRank(o.rank, league))

  if (bestRank < currentRank) {
    lines.push({
      key: 'md-best',
      label: 'Diesen Spieltag',
      primary:
        bestRank === 1
          ? 'kann Tabellenführer werden'
          : `kann Platz ${bestRank} erreichen`,
      tone: 'good',
    })
  }

  if (worstRank > currentRank) {
    lines.push({
      key: 'md-worst',
      label: 'Diesen Spieltag',
      primary: `kann auf Platz ${worstRank} fallen`,
      tone: 'bad',
    })
  }

  if (targetCertain) {
    lines.push({
      key: 'md-target-safe',
      label: 'Nach diesem Spieltag',
      primary: `${placeName} sicher`,
      tone: 'good',
    })
  } else if (canTarget) {
    lines.push({
      key: 'md-target-possible',
      label: 'Nach diesem Spieltag',
      primary: `${placeName} möglich`,
      tone: 'neutral',
    })
  } else if (isTopTargetRank(currentRank, league) || currentRank <= 6) {
    lines.push({
      key: 'md-target-gone',
      label: 'Nach diesem Spieltag',
      primary: `kein ${placeName}`,
      tone: 'bad',
    })
  }

  if (relegCertain) {
    lines.push({
      key: 'md-releg-safe',
      label: 'Nach diesem Spieltag',
      primary: 'Abstiegsplatz sicher',
      tone: 'bad',
    })
  } else if (canReleg) {
    lines.push({
      key: 'md-releg-possible',
      label: 'Nach diesem Spieltag',
      primary: 'Abstiegsplatz möglich',
      tone: 'neutral',
    })
  } else if (isRelegationRank(currentRank, league) || currentRank >= 12) {
    lines.push({
      key: 'md-releg-clear',
      label: 'Nach diesem Spieltag',
      primary: 'kein Abstiegsplatz',
      tone: 'good',
    })
  }

  // Spanne nach dem Spieltag, wenn noch nichts Zonales gesagt wurde
  if (
    lines.every((l) => !l.key.startsWith('md-') && !l.key.startsWith('live-'))
  ) {
    // no lines at all from outcomes - shouldn't happen if we have ranks
  }
  if (
    !lines.some((l) => l.key.startsWith('md-')) &&
    bestRank === worstRank
  ) {
    lines.push({
      key: 'md-stay',
      label: 'Nach diesem Spieltag',
      primary: `bleibt Platz ${bestRank}`,
      tone: 'neutral',
    })
  } else if (
    !lines.some((l) => l.key === 'md-best' || l.key === 'md-worst') &&
    bestRank !== worstRank
  ) {
    lines.push({
      key: 'md-span',
      label: 'Nach diesem Spieltag',
      primary: `Platz ${bestRank}–${worstRank} möglich`,
      tone: 'neutral',
    })
  }

  return lines
}

function mergeTriggersByKey(
  base: ThresholdLine[],
  extra: ThresholdLine[],
): ThresholdLine[] {
  const byKey = new Map<string, ThresholdLine>()
  for (const line of base) byKey.set(line.key, line)
  for (const line of extra) byKey.set(line.key, line)
  return sortTriggers([...byKey.values()])
}

function kickoffMs(match: Match): number | null {
  const raw = match.matchDateTimeUTC || match.matchDateTime
  if (!raw) return null
  const t = Date.parse(raw)
  return Number.isNaN(t) ? null : t
}

/** Nächster Spieltag „steht an“: Anstoß-Fenster rund um jetzt. */
export function isMatchdayAtHand(
  remaining: Match[],
  nowMs: number = Date.now(),
): boolean {
  const md = nextOpenMatchday(remaining)
  if (md == null) return false
  const fixtures = matchesOnMatchday(remaining, md)
  if (!fixtures.length) return false
  const kicks = fixtures
    .map(kickoffMs)
    .filter((t): t is number => t != null)
  if (!kicks.length) return true
  const earliest = Math.min(...kicks)
  const latest = Math.max(...kicks)
  const dayMs = 24 * 60 * 60 * 1000
  return nowMs >= earliest - dayMs && nowMs <= latest + MATCHDAY_DISPLAY_HOLD_MS
}

/**
 * Entscheidungs-Radar: bestätigter vs. Live-Stand aus vorhandenen Hard-/Exact- und
 * Schwellen-Bausteinen — keine neue Engine.
 */
export function buildDecisionRadar(input: {
  league: LeagueZoneId
  confirmedStandings: StandingRow[]
  liveStandings: StandingRow[]
  remainingConfirmed: Match[]
  remainingLive: Match[]
  hasLive: boolean
  includeTriggers?: boolean
  nowMs?: number
  priorScores?: MatchScore[]
}): DecisionRadar {
  const {
    league,
    confirmedStandings,
    liveStandings,
    remainingConfirmed,
    remainingLive,
    hasLive,
    includeTriggers = true,
    nowMs = Date.now(),
    priorScores = [],
  } = input

  const remainingForHorizon = hasLive ? remainingLive : remainingConfirmed
  const standingsForHorizon = hasLive ? liveStandings : confirmedStandings
  const matchdayAtHand = isMatchdayAtHand(remainingForHorizon, nowMs)
  const nextMatchday = nextOpenMatchday(remainingForHorizon)
  const showMatchdayHorizon = hasLive || nextMatchday != null

  const confirmedHard = computeHardRanges(confirmedStandings, remainingConfirmed)
  const liveHard = hasLive
    ? computeHardRanges(liveStandings, remainingLive)
    : confirmedHard
  const ranges = computePositionRanges(confirmedStandings, remainingConfirmed)
  const rangeById = new Map(ranges.map((r) => [r.teamId, r]))
  const confHardById = new Map(confirmedHard.map((h) => [h.teamId, h]))
  const liveHardById = new Map(liveHard.map((h) => [h.teamId, h]))
  const liveRowById = new Map(liveStandings.map((r) => [r.teamId, r]))

  const matchdayFixtures =
    nextMatchday != null
      ? matchesOnMatchday(remainingForHorizon, nextMatchday)
      : []
  const matchdayExact =
    matchdayFixtures.length > 0 && matchdayFixtures.length <= 12

  const matchdayOutcomesByTeam =
    includeTriggers && nextMatchday != null
      ? enumerateMatchdayOutcomesByTeam(
          standingsForHorizon,
          remainingForHorizon,
          priorScores,
        )
      : null

  const all: DecisionTeamRow[] = confirmedStandings.map((row) => {
    const ch = confHardById.get(row.teamId) ?? {
      teamId: row.teamId,
      hardBest: row.rank,
      hardWorst: row.rank,
    }
    const lh = liveHardById.get(row.teamId) ?? ch
    const range = rangeById.get(row.teamId) ?? {
      teamId: row.teamId,
      bestRank: ch.hardBest,
      worstRank: ch.hardWorst,
      mode: 'hard' as const,
    }
    const confirmedStatuses = deriveDecisionStatuses(ch, league)
    const liveStatuses = hasLive
      ? deriveDecisionStatuses(lh, league)
      : confirmedStatuses
    const deltas = hasLive
      ? diffDecisionStatuses(confirmedStatuses, liveStatuses)
      : []
    const liveRow = liveRowById.get(row.teamId) ?? row

    let seasonTriggers: ThresholdLine[] = []
    let matchdayTriggers: ThresholdLine[] = []
    let matchdayTriggersExact = false

    // Spieltag: ein 3ⁿ-Durchlauf für alle Teams (nicht 18×). Saison bleibt
    // team-spezifisch (andere Restspiele). useMatchdayOutlooks ist nur der
    // gewählte Verein und hier nicht wiederverwendbar.
    if (includeTriggers) {
      const seasonHard = hasLive ? lh : ch
      const seasonOutcomes = seasonExtremeOutcomes(
        standingsForHorizon,
        remainingForHorizon,
        row.teamId,
        priorScores,
      )
      if (seasonOutcomes) {
        seasonTriggers = sortTriggers(
          filterSeasonTriggersByHard(
            deriveThresholdLines(
              seasonOutcomes,
              liveRow.points,
              liveRow.rank,
              league,
              { exact: false, horizon: 'season' },
            ),
            seasonHard,
            league,
          ),
        )
      }

      if (nextMatchday != null) {
        const mdOutcomes = matchdayOutcomesByTeam?.get(row.teamId)
        if (mdOutcomes) {
          const playsNext = matchdayFixtures.some(
            (m) =>
              m.team1.teamId === row.teamId || m.team2.teamId === row.teamId,
          )
          const caps = {
            canSecureTarget: matchdayCanSecureTarget(
              standingsForHorizon,
              remainingForHorizon,
              nextMatchday,
              row.teamId,
              league,
            ),
            canEliminateTarget: matchdayCanEliminateTarget(
              standingsForHorizon,
              remainingForHorizon,
              nextMatchday,
              row.teamId,
              league,
            ),
            canSecureSurvival: matchdayCanSecureSurvival(
              standingsForHorizon,
              remainingForHorizon,
              nextMatchday,
              row.teamId,
              league,
            ),
            canForceRelegation: matchdayCanForceRelegation(
              standingsForHorizon,
              remainingForHorizon,
              nextMatchday,
              row.teamId,
              league,
            ),
          }
          // Saison-Clinch, der diesen Spieltag kippen kann — Saison-Sprache
          const seasonClinch = filterSeasonTriggersByHard(
            filterMatchdayTriggersBySeasonHard(
              deriveThresholdLines(
                mdOutcomes,
                liveRow.points,
                liveRow.rank,
                league,
                {
                  exact: matchdayExact,
                  reachableMax: liveRow.points + (playsNext ? 3 : 0),
                  horizon: 'season',
                },
              ),
              seasonHard,
              league,
              caps,
            ),
            seasonHard,
            league,
          )
          seasonTriggers = mergeTriggersByKey(seasonTriggers, seasonClinch)

          // Spieltags-Ebene: nur Positions-Aussagen
          matchdayTriggersExact = matchdayExact
          matchdayTriggers = deriveMatchdayPositionLines(
            mdOutcomes,
            liveRow.rank,
            league,
            {
              hasLive,
              liveRank: liveRow.rank,
              confirmedRank: row.rank,
            },
          )
        }
      }
    }

    return {
      teamId: row.teamId,
      teamName: row.teamName,
      shortName: row.shortName || row.teamName,
      teamIconUrl: row.teamIconUrl,
      rank: liveRow.rank,
      points: liveRow.points,
      confirmedHard: ch,
      liveHard: lh,
      range,
      confirmedStatuses,
      liveStatuses,
      deltas,
      seasonTriggers,
      matchdayTriggers,
      matchdayTriggersExact,
    }
  })

  all.sort((a, b) => a.rank - b.rank)

  const activeStatuses = (r: DecisionTeamRow) =>
    hasLive ? r.liveStatuses : r.confirmedStatuses

  const decided = all.filter((r) => activeStatuses(r).length > 0)
  const pending = all.filter((r) => {
    if (r.deltas.length > 0) return true
    if (activeStatuses(r).length > 0) return false
    if (r.seasonTriggers.length > 0) return true
    if (showMatchdayHorizon && r.matchdayTriggers.length > 0) return true
    return false
  })

  return {
    hasLive,
    showMatchdayHorizon,
    matchdayAtHand,
    nextMatchday,
    decided,
    pending,
    all,
  }
}

/** Für Tests: Status-Konsistenz mit Exact-Spanne (Exact ⊆ Hard). */
export function statusConsistentWithExact(
  hard: HardRange,
  exact: PositionRange,
  league: LeagueZoneId,
): boolean {
  if (exact.bestRank < hard.hardBest || exact.worstRank > hard.hardWorst) {
    return false
  }
  const fromHard = deriveDecisionStatuses(hard, league)
  for (const s of fromHard) {
    if (s.kind === 'champion' && exact.worstRank !== 1) return false
    if (s.kind === 'relegated' && !isRelegationRank(exact.bestRank, league)) {
      return false
    }
    if (s.kind === 'safe' && isRelegationRank(exact.worstRank, league)) {
      return false
    }
    if (
      s.kind === 'title_secure' &&
      !isTopTargetRank(exact.worstRank, league)
    ) {
      return false
    }
    if (s.kind === 'title_gone' && isTopTargetRank(exact.bestRank, league)) {
      return false
    }
  }
  return true
}
