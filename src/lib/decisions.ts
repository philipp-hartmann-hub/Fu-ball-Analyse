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
  seasonOutcomesForTeam,
} from './scenarios'
import {
  deriveThresholdLines,
  isRelegationRank,
  isTopTargetRank,
  topTargetLabel,
  type PointRankOutcome,
  type ThresholdLine,
} from './thresholds'
import {
  zoneForRank,
  zoneLabelFor,
  zoneLegendFor,
  type LeagueZoneId,
} from './table'

/**
 * „Ziel nicht mehr möglich“ nur, wenn hardBest (oder aktueller Rang) höchstens
 * so viele Plätze hinter dem letzten Top-Ziel-Rang liegt — sonst trivial.
 */
export const TITLE_GONE_NEAR_PLACES = 4

/** Letzter Rang der Top-Zielzone (BL1: CL ≤4, BL2/3: Direktaufstieg ≤2). */
export function lastTopTargetRank(league: LeagueZoneId): number {
  if (league === 'bl2' || league === 'bl3') return 2
  return 4
}

/**
 * Ob „CL/Aufstieg nicht mehr möglich“ inhaltlich relevant ist (nah an der Zone),
 * nicht pauschal für jeden außerhalb der Zielzone.
 */
export function isTitleGoneRelevant(
  hard: HardRange,
  league: LeagueZoneId,
  currentRank?: number,
): boolean {
  if (isRelegationRank(hard.hardBest, league)) return false
  if (isTopTargetRank(hard.hardBest, league)) return false
  const cutoff = lastTopTargetRank(league) + TITLE_GONE_NEAR_PLACES
  if (hard.hardBest <= cutoff) return true
  if (currentRank != null && currentRank <= cutoff) return true
  return false
}

function parseSeasonZoneLine(
  key: string,
): { zone: string; kind: 'safe' | 'possible' | 'gone' } | null {
  const m = key.match(/^season-(.+)-(safe|possible|gone)$/)
  if (!m) return null
  return { zone: m[1]!, kind: m[2] as 'safe' | 'possible' | 'gone' }
}

function isTopTargetZone(zone: string, league: LeagueZoneId): boolean {
  if (league === 'bl1') return zone === 'champion' || zone === 'cl'
  // BL2/3: Direktaufstieg = champion (Plätze 1–2)
  return zone === 'champion'
}

function isRelegationZone(zone: string): boolean {
  return zone === 'relegation' || zone === 'direct-relegation'
}

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
  opts?: { currentRank?: number },
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

  if (
    !isTopTargetRank(hardBest, league) &&
    hardWorst !== 1 &&
    isTitleGoneRelevant(hard, league, opts?.currentRank)
  ) {
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
 * (Hart schlägt Näherung zur selben Zone).
 */
export function triggersBeyondStatus(
  statuses: DecisionStatus[],
  lines: ThresholdLine[],
  opts?: {
    hard?: HardRange
    league?: LeagueZoneId
    currentRank?: number
  },
): ThresholdLine[] {
  const kinds = new Set(statuses.map((s) => s.kind))
  const league = opts?.league
  const hard = opts?.hard

  return lines.filter((line) => {
    if (line.key === 'survive-safe' && kinds.has('safe')) return false
    if (line.key === 'releg-certain' && kinds.has('relegated')) return false
    if (
      line.key === 'target-safe' &&
      (kinds.has('title_secure') || kinds.has('champion'))
    ) {
      return false
    }
    // Triviale / doppelte „Ziel weg“-Zeilen
    if (line.key === 'target-gone') {
      if (kinds.has('title_gone') || kinds.has('relegated') || kinds.has('safe')) {
        return false
      }
      if (
        hard &&
        league &&
        !isTitleGoneRelevant(hard, league, opts?.currentRank)
      ) {
        return false
      }
    }

    const zoneLine = parseSeasonZoneLine(line.key)
    if (zoneLine) {
      // Hart-Abstieg → keine Näherung „Abstiegsplatz sicher“
      if (
        kinds.has('relegated') &&
        isRelegationZone(zoneLine.zone) &&
        zoneLine.kind === 'safe'
      ) {
        return false
      }
      // Hart gerettet → keine Näherung „kein Abstiegsplatz“ / Abstieg-gone
      if (
        kinds.has('safe') &&
        isRelegationZone(zoneLine.zone) &&
        (zoneLine.kind === 'gone' || zoneLine.kind === 'safe')
      ) {
        return false
      }
      // Hart Meister / CL sicher → keine Näherung „… sicher“ zur Zielzone
      if (
        (kinds.has('champion') || kinds.has('title_secure')) &&
        league &&
        isTopTargetZone(zoneLine.zone, league) &&
        zoneLine.kind === 'safe'
      ) {
        return false
      }
      // Triviale Ziel-gone-Näherung
      if (
        zoneLine.kind === 'gone' &&
        league &&
        isTopTargetZone(zoneLine.zone, league)
      ) {
        if (kinds.has('title_gone') || kinds.has('relegated') || kinds.has('safe')) {
          return false
        }
        if (
          hard &&
          !isTitleGoneRelevant(hard, league, opts?.currentRank)
        ) {
          return false
        }
      }
    }

    return true
  })
}

/**
 * Saison-Trigger bereinigen: Hart schlägt Näherung, triviale Ziel-Negativzeilen weg.
 */
export function pruneSeasonTriggers(
  statuses: DecisionStatus[],
  lines: ThresholdLine[],
  hard: HardRange,
  league: LeagueZoneId,
  currentRank: number,
): ThresholdLine[] {
  return triggersBeyondStatus(statuses, lines, {
    hard,
    league,
    currentRank,
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
 * Kurze Platz-Bezeichnung für die Spieltags-Ebene (nicht Saison-Clinch).
 */
function matchdayPlaceLabel(zone: string, league: LeagueZoneId): string {
  if (league === 'bl1') {
    if (zone === 'champion') return 'Meisterplatz'
    if (zone === 'cl') return 'CL-Platz'
    if (zone === 'el') return 'EL-Platz'
    if (zone === 'ecl') return 'ECL-Platz'
    if (zone === 'relegation') return 'Relegationsplatz'
    if (zone === 'direct-relegation') return 'Abstiegsplatz'
  }
  if (league === 'bl2' || league === 'bl3') {
    if (zone === 'champion') return 'Aufstiegsplatz'
    if (zone === 'cl') return 'Relegationsplatz Aufstieg'
    if (zone === 'relegation') return 'Relegationsplatz Abstieg'
    if (zone === 'direct-relegation') return 'Abstiegsplatz'
  }
  return zoneLabelFor(
    zone === 'champion' ? 1 : zone === 'cl' ? 4 : 18,
    league,
  )
}

function pushZoneLines(
  lines: ThresholdLine[],
  keyPrefix: string,
  placeLabel: string,
  toneReach: 'good' | 'bad' | 'neutral',
  can: boolean,
  certain: boolean,
  nowIn: boolean,
  horizon: 'matchday' | 'season',
): void {
  const md = horizon === 'matchday'
  if (certain) {
    lines.push({
      key: `${keyPrefix}-safe`,
      label: md ? 'Nach diesem Spieltag' : 'Saison',
      primary: `${placeLabel} sicher`,
      tone: toneReach === 'bad' ? 'bad' : 'good',
    })
  } else if (can) {
    lines.push({
      key: `${keyPrefix}-possible`,
      label: md ? (nowIn ? 'Diesen Spieltag' : 'Nach diesem Spieltag') : 'Saison',
      primary: nowIn
        ? `bleibt ${placeLabel} möglich`
        : `${placeLabel} möglich`,
      tone: toneReach,
    })
  } else if (nowIn) {
    lines.push({
      key: `${keyPrefix}-gone`,
      label: md ? 'Nach diesem Spieltag' : 'Saison',
      primary: `kein ${placeLabel} mehr`,
      tone: toneReach === 'bad' ? 'good' : 'bad',
    })
  }
}

/** Liegt der Rangbereich [hardBest, hardWorst] noch in dieser Zone? */
export function zoneReachableInHardSpan(
  hard: HardRange,
  zone: string,
  league: LeagueZoneId,
): boolean {
  for (let r = hard.hardBest; r <= hard.hardWorst; r++) {
    if (zoneForRank(r, league) === zone) return true
  }
  return false
}

export function filterSeasonZoneLinesByHard(
  lines: ThresholdLine[],
  hard: HardRange,
  currentRank: number,
  league: LeagueZoneId,
): ThresholdLine[] {
  return lines.filter((line) => {
    const m = line.key.match(/^season-(?:md-)?(.+?)-(safe|possible|gone)$/)
    if (!m) return true
    const zone = m[1]!
    if (zoneForRank(currentRank, league) === zone) return true
    return zoneReachableInHardSpan(hard, zone, league)
  })
}

/**
 * Spieltags-Ebene: relevante Zonen (Tabellenführer, CL/EL/ECL, Relegation,
 * Aufstieg/Abstieg) über alle Spieltags-Konstellationen.
 * Wer schon auf so einem Platz steht, erscheint ebenfalls.
 * Leere Liste = Verein in der Spieltags-Liste weglassen.
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
  const zones = zoneLegendFor(league)
  const inZone = (rank: number, zone: string) =>
    zoneForRank(rank, league) === zone

  if (opts?.hasLive && opts.liveRank != null && opts.confirmedRank != null) {
    const live = opts.liveRank
    const conf = opts.confirmedRank
    if (live === 1 && conf !== 1) {
      lines.push({
        key: 'live-leader',
        label: 'Zwischenstand',
        primary: 'jetzt Tabellenführer',
        tone: 'good',
      })
    } else if (conf === 1 && live !== 1) {
      lines.push({
        key: 'live-leader-lost',
        label: 'Zwischenstand',
        primary: 'nicht mehr Tabellenführer',
        tone: 'bad',
      })
    }
    for (const { zone } of zones) {
      const placeLabel = matchdayPlaceLabel(zone, league)
      const liveIn = inZone(live, zone)
      const confIn = inZone(conf, zone)
      if (liveIn === confIn) continue
      const badZone = zone === 'relegation' || zone === 'direct-relegation'
      lines.push({
        key: `live-${zone}`,
        label: 'Zwischenstand',
        primary: liveIn ? `jetzt ${placeLabel}` : `nicht mehr ${placeLabel}`,
        tone: liveIn
          ? badZone
            ? 'bad'
            : 'good'
          : badZone
            ? 'good'
            : 'bad',
      })
    }
  }

  if (!outcomes.length) return lines

  const canLead = outcomes.some((o) => o.rank === 1)
  const leadCertain = outcomes.every((o) => o.rank === 1)
  const nowLead = currentRank === 1

  if (leadCertain) {
    lines.push({
      key: 'md-leader-safe',
      label: 'Nach diesem Spieltag',
      primary: 'Tabellenführer sicher',
      tone: 'good',
    })
  } else if (canLead && !nowLead) {
    lines.push({
      key: 'md-leader',
      label: 'Diesen Spieltag',
      primary: 'kann Tabellenführer werden',
      tone: 'good',
    })
  } else if (canLead && nowLead) {
    lines.push({
      key: 'md-leader-stay',
      label: 'Diesen Spieltag',
      primary: 'bleibt Tabellenführer möglich',
      tone: 'good',
    })
  } else if (!canLead && nowLead) {
    lines.push({
      key: 'md-leader-gone',
      label: 'Nach diesem Spieltag',
      primary: 'kein Tabellenführer mehr',
      tone: 'bad',
    })
  }

  for (const { zone } of zones) {
    // Tabellenführer deckt BL1-Meister / Platz 1 ab — champion-Zone für BL1
    // zusätzlich als Meisterplatz nur wenn nicht redundant mit Leader-Zeilen
    if (league === 'bl1' && zone === 'champion') continue

    const placeLabel = matchdayPlaceLabel(zone, league)
    const can = outcomes.some((o) => inZone(o.rank, zone))
    const certain = outcomes.every((o) => inZone(o.rank, zone))
    const nowIn = inZone(currentRank, zone)
    const badZone = zone === 'relegation' || zone === 'direct-relegation'
    pushZoneLines(
      lines,
      `md-${zone}`,
      placeLabel,
      badZone ? 'bad' : 'neutral',
      can,
      certain,
      nowIn,
      'matchday',
    )
  }

  return lines
}

/**
 * Saison-Ebene: relevante Zonen (CL/EL/ECL, Relegation, …) über Restspiele.
 * Unabhängig vom CL-only-Schwellen-Modell — wichtig für EL/ECL in der BL1.
 */
export function deriveSeasonZoneLines(
  outcomes: PointRankOutcome[],
  currentRank: number,
  league: LeagueZoneId,
): ThresholdLine[] {
  const lines: ThresholdLine[] = []
  const zones = zoneLegendFor(league)
  const inZone = (rank: number, zone: string) =>
    zoneForRank(rank, league) === zone

  if (!outcomes.length) return lines

  for (const { zone } of zones) {
    if (league === 'bl1' && zone === 'champion') continue

    const placeLabel = matchdayPlaceLabel(zone, league)
    const can = outcomes.some((o) => inZone(o.rank, zone))
    const certain = outcomes.every((o) => inZone(o.rank, zone))
    const nowIn = inZone(currentRank, zone)
    const badZone = zone === 'relegation' || zone === 'direct-relegation'
    pushZoneLines(
      lines,
      `season-${zone}`,
      placeLabel,
      badZone ? 'bad' : 'neutral',
      can,
      certain,
      nowIn,
      'season',
    )
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
    const liveRow = liveRowById.get(row.teamId) ?? row
    const confirmedStatuses = deriveDecisionStatuses(ch, league, {
      currentRank: row.rank,
    })
    const liveStatuses = hasLive
      ? deriveDecisionStatuses(lh, league, { currentRank: liveRow.rank })
      : confirmedStatuses
    const deltas = hasLive
      ? diffDecisionStatuses(confirmedStatuses, liveStatuses)
      : []

    let seasonTriggers: ThresholdLine[] = []
    let matchdayTriggers: ThresholdLine[] = []
    let matchdayTriggersExact = false

    // Spieltag: ein 3ⁿ-Durchlauf für alle Teams (nicht 18×). Saison bleibt
    // team-spezifisch (andere Restspiele). useMatchdayOutlooks ist nur der
    // gewählte Verein und hier nicht wiederverwendbar.
    if (includeTriggers) {
      const seasonHard = hasLive ? lh : ch
      const statusForTriggers = hasLive ? liveStatuses : confirmedStatuses
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

      const seasonZoneOutcomes = seasonOutcomesForTeam(
        standingsForHorizon,
        remainingForHorizon,
        row.teamId,
        priorScores,
      )
      if (seasonZoneOutcomes?.length) {
        const zoneLines = filterSeasonZoneLinesByHard(
          deriveSeasonZoneLines(
            seasonZoneOutcomes,
            liveRow.rank,
            league,
          ),
          seasonHard,
          liveRow.rank,
          league,
        )
        seasonTriggers = mergeTriggersByKey(seasonTriggers, zoneLines)
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

      seasonTriggers = pruneSeasonTriggers(
        statusForTriggers,
        seasonTriggers,
        seasonHard,
        league,
        liveRow.rank,
      )
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
