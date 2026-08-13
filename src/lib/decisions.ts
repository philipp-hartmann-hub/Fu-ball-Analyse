import type { HardRange, Match, PositionRange, StandingRow } from '../types'
import { MATCHDAY_DISPLAY_HOLD_MS } from './live'
import {
  computeHardRanges,
  computePositionRanges,
  enumerateMatchdayOutcomes,
  matchesOnMatchday,
  nextOpenMatchday,
  seasonExtremeOutcomes,
} from './scenarios'
import {
  deriveThresholdLines,
  isRelegationRank,
  isTopTargetRank,
  topTargetLabel,
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
   * Spieltags-/Live-Blöcke zeigen: laufende Spiele oder nächster Spieltag steht an.
   * Sonst nur Saison-Status + Saison-Auslöser.
   */
  showMatchdayHorizon: boolean
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

function compactTriggers(lines: ThresholdLine[], max = 2): ThresholdLine[] {
  const preferred = [
    'survive-from',
    'survive-safe',
    'releg-certain',
    'target-secure-from',
    'target-safe',
    'target-gone',
    'target-possible-from',
  ]
  const ranked = [...lines].sort((a, b) => {
    const ia = preferred.indexOf(a.key)
    const ib = preferred.indexOf(b.key)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  return ranked.slice(0, max)
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
  } = input

  const remainingForHorizon = hasLive ? remainingLive : remainingConfirmed
  const standingsForHorizon = hasLive ? liveStandings : confirmedStandings
  const matchdayAtHand = isMatchdayAtHand(remainingForHorizon, nowMs)
  const showMatchdayHorizon = hasLive || matchdayAtHand
  const nextMatchday = nextOpenMatchday(remainingForHorizon)

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

    if (includeTriggers) {
      const seasonOutcomes = seasonExtremeOutcomes(
        standingsForHorizon,
        remainingForHorizon,
        row.teamId,
      )
      if (seasonOutcomes) {
        seasonTriggers = compactTriggers(
          deriveThresholdLines(
            seasonOutcomes,
            liveRow.points,
            liveRow.rank,
            league,
            { exact: false, horizon: 'season' },
          ),
        )
      }

      if (showMatchdayHorizon && nextMatchday != null) {
        const mdOutcomes = enumerateMatchdayOutcomes(
          standingsForHorizon,
          remainingForHorizon,
          row.teamId,
        )
        if (mdOutcomes) {
          const playsNext = matchdayFixtures.some(
            (m) =>
              m.team1.teamId === row.teamId || m.team2.teamId === row.teamId,
          )
          matchdayTriggersExact = matchdayExact
          matchdayTriggers = compactTriggers(
            deriveThresholdLines(
              mdOutcomes,
              liveRow.points,
              liveRow.rank,
              league,
              {
                exact: matchdayExact,
                reachableMax: liveRow.points + (playsNext ? 3 : 0),
                horizon: 'matchday',
              },
            ),
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
