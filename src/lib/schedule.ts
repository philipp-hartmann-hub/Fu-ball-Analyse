import type { Match, StandingRow } from '../types'
import { hasEnoughData } from './reliability'
import {
  DEFAULT_ATTACK,
  DEFAULT_DEFENSE,
  deriveTeamStrengths,
  predictMatch,
} from './simulation'

/**
 * Restprogramm aus Vereinssicht (Poisson-1X2, gleiches Modell wie Spielschätzung).
 *
 * Pro Restspiel: erwartete Punkte = P(Sieg)·3 + P(Remis)·1 (Heim/Auswärts über λ).
 * Summe → expectedRemainingPoints; Mittel → expectedPerGame.
 * Vergleich mit eigenem PPG (ownAverage): darüber „leicht“, darunter „schwer“,
 * nahe dran „durchschnittlich“ — nicht relativ zur Liga.
 *
 * `reliable` nur bei `hasEnoughData` (Median ≥ MIN_GAMES).
 */

/** |expectedPerGame − ownAverage| darunter → „durchschnittlich“. */
export const DIFFICULTY_EPS = 0.2

/** Neutrales PPG, wenn der Verein noch 0 Spiele hat (bei sonst genug Liga-Daten). */
export const NEUTRAL_OWN_PPG = 1.0

/** @deprecated Nutze MIN_GAMES / hasEnoughData aus `./reliability`. */
export { MIN_GAMES as MIN_GAMES_FOR_HARDNESS } from './reliability'

export type HardnessGrade = 'easy' | 'mid' | 'hard'

export interface ScheduleHardness {
  teamId: number
  remainingGames: number
  /** Summe erwarteter Punkte über alle Restspiele */
  expectedRemainingPoints: number
  /** expectedRemainingPoints / remainingGames (0 ohne Restspiele) */
  expectedPerGame: number
  /** Bisherige Punkte/Spiel; null bei 0 Spielen */
  ownAverage: number | null
  /** expectedPerGame − ownAverage (bzw. Neutral-PPG); null wenn !reliable */
  difficultyDelta: number | null
  /** null wenn !reliable oder keine Restspiele */
  grade: HardnessGrade | null
  /**
   * false, wenn noch zu wenige Spiele gespielt sind (`!hasEnoughData`)
   * — dann keine Einstufung / keine Restpunkte-Aussage in der UI.
   */
  reliable: boolean
}

function expectedPointsFromFocus(
  pWin: number,
  pDraw: number,
): number {
  return pWin * 3 + pDraw * 1
}

/**
 * Erwartete Restpunkte und Einstufung je Verein aus dem Poisson-Modell.
 * `matches` = Restfixtures, `standings` = aktuelle Tabelle (Stärken + eigenes PPG).
 */
export function computeScheduleHardness(
  matches: Match[],
  standings: StandingRow[],
): ScheduleHardness[] {
  const reliable = hasEnoughData(standings)
  const { strengths, avgDefense } = deriveTeamStrengths(standings)

  const acc = new Map<number, { sum: number; n: number }>()
  for (const row of standings) {
    acc.set(row.teamId, { sum: 0, n: 0 })
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

    const pred = predictMatch(homeStr, awayStr, avgDefense)

    if (homeBucket) {
      homeBucket.sum += expectedPointsFromFocus(pred.pHome, pred.pDraw)
      homeBucket.n += 1
    }
    if (awayBucket) {
      awayBucket.sum += expectedPointsFromFocus(pred.pAway, pred.pDraw)
      awayBucket.n += 1
    }
  }

  return standings.map((row) => {
    const bucket = acc.get(row.teamId) ?? { sum: 0, n: 0 }
    const remainingGames = bucket.n
    const expectedRemainingPoints = bucket.sum
    const expectedPerGame =
      remainingGames > 0 ? expectedRemainingPoints / remainingGames : 0
    const ownAverage = row.played > 0 ? row.points / row.played : null

    let grade: HardnessGrade | null = null
    let difficultyDelta: number | null = null

    if (reliable && remainingGames > 0) {
      const baseline = ownAverage ?? NEUTRAL_OWN_PPG
      difficultyDelta = expectedPerGame - baseline
      if (difficultyDelta > DIFFICULTY_EPS) grade = 'easy'
      else if (difficultyDelta < -DIFFICULTY_EPS) grade = 'hard'
      else grade = 'mid'
    }

    return {
      teamId: row.teamId,
      remainingGames,
      expectedRemainingPoints,
      expectedPerGame,
      ownAverage,
      difficultyDelta,
      grade,
      reliable,
    }
  })
}

/** Kurzlabel ohne Vereinsbezug. */
export function hardnessGradeLabel(grade: HardnessGrade): string {
  switch (grade) {
    case 'easy':
      return 'leicht'
    case 'mid':
      return 'durchschnittlich'
    case 'hard':
      return 'schwer'
  }
}

/** „leicht für Köln“ usw. */
export function hardnessGradeLabelForClub(
  grade: HardnessGrade,
  clubName: string,
): string {
  return `${hardnessGradeLabel(grade)} für ${clubName}`
}

/** Anzeige „~12“ / „~12,5“ für erwartete Restpunkte. */
export function formatExpectedRemainingPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10
  if (Number.isInteger(rounded)) return `~${rounded}`
  return `~${rounded.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`
}

/** Median der `played`-Werte; leere Liga → 0. */
export { medianGamesPlayed } from './reliability'
