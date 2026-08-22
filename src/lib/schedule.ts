import type { Match, StandingRow } from '../types'
import { hasEnoughData } from './reliability'
import {
  DEFAULT_ATTACK,
  DEFAULT_DEFENSE,
  deriveMatchLean,
  deriveTeamStrengths,
  predictMatch,
} from './simulation'

/**
 * Restprogramm-Härte aus Vereinssicht (Poisson-1X2).
 *
 * Pro Restspiel: erwartete Punkte = P(Sieg)·3 + P(Remis)·1 (nur intern).
 * expectedPerGame = Mittel über die Restspiele.
 * Einstufung ABSOLUT an expectedPerGame (0…3) — nicht relativ zum eigenen PPG.
 *
 * Konsistenz: Mehrheit „Niederlage wahrscheinlich“ → Stufe mindestens „schwer“.
 * `reliable` nur bei `hasEnoughData`.
 */

/** @deprecated Nutze MIN_GAMES / hasEnoughData aus `./reliability`. */
export { MIN_GAMES as MIN_GAMES_FOR_HARDNESS } from './reliability'

/** expectedPerGame ≥ … → sehr leicht */
export const HARDNESS_VERY_EASY_MIN = 1.9
/** … → leicht */
export const HARDNESS_EASY_MIN = 1.6
/** … → mittel */
export const HARDNESS_MID_MIN = 1.2
/** … → schwer; darunter sehr schwer */
export const HARDNESS_HARD_MIN = 0.9

export type HardnessGrade =
  | 'very-easy'
  | 'easy'
  | 'mid'
  | 'hard'
  | 'very-hard'

export interface ScheduleHardness {
  teamId: number
  remainingGames: number
  /**
   * Intern: Mittel der erwarteten Punkte/Spiel (0…3).
   * Nicht in der UI anzeigen.
   */
  expectedPerGame: number
  /** Intern: Summe erwarteter Restpunkte. */
  expectedRemainingPoints: number
  /** Anteil Restspiele mit Lean „Niederlage wahrscheinlich“ (0…1). */
  lossLikelyShare: number
  /** null wenn !reliable oder keine Restspiele */
  grade: HardnessGrade | null
  /**
   * false bei `!hasEnoughData` — keine Stufe in der UI.
   */
  reliable: boolean
}

const GRADE_ORDER: HardnessGrade[] = [
  'very-easy',
  'easy',
  'mid',
  'hard',
  'very-hard',
]

function expectedPointsFromFocus(pWin: number, pDraw: number): number {
  return pWin * 3 + pDraw * 1
}

/** Absolute Einstufung aus erwarteten Punkten pro Restspiel. */
export function gradeFromExpectedPerGame(epg: number): HardnessGrade {
  if (epg >= HARDNESS_VERY_EASY_MIN) return 'very-easy'
  if (epg >= HARDNESS_EASY_MIN) return 'easy'
  if (epg >= HARDNESS_MID_MIN) return 'mid'
  if (epg >= HARDNESS_HARD_MIN) return 'hard'
  return 'very-hard'
}

/**
 * Wenn die Mehrheit der Restspiele „Niederlage wahrscheinlich“ ist,
 * darf die Stufe nicht leicht/sehr leicht/mittel sein → mindestens schwer.
 */
export function clampGradeForLossMajority(
  grade: HardnessGrade,
  lossLikelyShare: number,
): HardnessGrade {
  if (lossLikelyShare <= 0.5) return grade
  const hardIdx = GRADE_ORDER.indexOf('hard')
  const idx = GRADE_ORDER.indexOf(grade)
  return idx < hardIdx ? 'hard' : grade
}

/**
 * Einstufung je Verein aus dem Poisson-Modell (absolute Skala).
 * `matches` = Restfixtures, `standings` = aktuelle Tabelle für Stärken.
 *
 * Optional: vorberechnete Stärken und `onlyTeamIds` für partielle Berechnung
 * (ein `deriveTeamStrengths`-Lauf, mehrere Aufrufe).
 */
export function computeScheduleHardness(
  matches: Match[],
  standings: StandingRow[],
  opts?: {
    precomputedStrengths?: ReturnType<typeof deriveTeamStrengths>
    onlyTeamIds?: readonly number[]
  },
): ScheduleHardness[] {
  const reliable = hasEnoughData(standings)
  const { strengths, avgDefense } =
    opts?.precomputedStrengths ?? deriveTeamStrengths(standings)
  const only = opts?.onlyTeamIds?.length
    ? new Set(opts.onlyTeamIds)
    : null

  const acc = new Map<
    number,
    { sum: number; n: number; lossLikely: number }
  >()
  for (const row of standings) {
    if (only && !only.has(row.teamId)) continue
    acc.set(row.teamId, { sum: 0, n: 0, lossLikely: 0 })
  }

  for (const m of matches) {
    const homeId = m.team1.teamId
    const awayId = m.team2.teamId
    const homeBucket = acc.get(homeId)
    const awayBucket = acc.get(awayId)
    if (!homeBucket && !awayBucket) continue

    const homeStr =
      strengths.get(homeId) ?? {
        teamId: homeId,
        attack: DEFAULT_ATTACK,
        defense: DEFAULT_DEFENSE,
      }
    const awayStr =
      strengths.get(awayId) ?? {
        teamId: awayId,
        attack: DEFAULT_ATTACK,
        defense: DEFAULT_DEFENSE,
      }

    const pred = predictMatch(homeStr, awayStr, avgDefense, {
      reliable: true,
    })

    if (homeBucket) {
      homeBucket.sum += expectedPointsFromFocus(pred.pHome, pred.pDraw)
      homeBucket.n += 1
      const lean = deriveMatchLean(pred, 'home')
      if (lean.outcome === 'loss' && lean.confidence === 'likely') {
        homeBucket.lossLikely += 1
      }
    }
    if (awayBucket) {
      awayBucket.sum += expectedPointsFromFocus(pred.pAway, pred.pDraw)
      awayBucket.n += 1
      const lean = deriveMatchLean(pred, 'away')
      if (lean.outcome === 'loss' && lean.confidence === 'likely') {
        awayBucket.lossLikely += 1
      }
    }
  }

  return standings
    .filter((row) => !only || only.has(row.teamId))
    .map((row) => {
    const bucket = acc.get(row.teamId) ?? { sum: 0, n: 0, lossLikely: 0 }
    const remainingGames = bucket.n
    const expectedRemainingPoints = bucket.sum
    const expectedPerGame =
      remainingGames > 0 ? expectedRemainingPoints / remainingGames : 0
    const lossLikelyShare =
      remainingGames > 0 ? bucket.lossLikely / remainingGames : 0

    let grade: HardnessGrade | null = null
    if (reliable && remainingGames > 0) {
      grade = clampGradeForLossMajority(
        gradeFromExpectedPerGame(expectedPerGame),
        lossLikelyShare,
      )
    }

    return {
      teamId: row.teamId,
      remainingGames,
      expectedPerGame,
      expectedRemainingPoints,
      lossLikelyShare,
      grade,
      reliable,
    }
  })
}

export function hardnessGradeLabel(grade: HardnessGrade): string {
  switch (grade) {
    case 'very-easy':
      return 'sehr leicht'
    case 'easy':
      return 'leicht'
    case 'mid':
      return 'mittel'
    case 'hard':
      return 'schwer'
    case 'very-hard':
      return 'sehr schwer'
  }
}

/** „leicht für Köln“ usw. */
export function hardnessGradeLabelForClub(
  grade: HardnessGrade,
  clubName: string,
): string {
  return `${hardnessGradeLabel(grade)} für ${clubName}`
}

/** Median der `played`-Werte; leere Liga → 0. */
export { medianGamesPlayed } from './reliability'
