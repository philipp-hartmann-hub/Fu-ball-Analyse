import type { Match, StandingRow } from '../types'
import { hasEnoughData } from './reliability'
import {
  DEFAULT_ATTACK,
  DEFAULT_DEFENSE,
  deriveTeamStrengths,
  predictMatch,
} from './simulation'
import { finalResult } from './table'

/**
 * Form-Trend relativ zur Erwartung (Poisson) — nicht nackte S/U/N-Serie.
 *
 * Pro abgeschlossenes Spiel: tatsächlich − erwartet (Überperformance).
 * trendScore = Mittel (optional recency-gewichtet) über die letzten N Spiele.
 */

/** Wie viele abgeschlossene Spiele fließen ein. */
export const TREND_WINDOW = 5

/**
 * Wenn true: jüngere Spiele etwas stärker (lineare Gewichte 1…N, normalisiert).
 * Schaltbar als Konstante.
 */
export const TREND_USE_RECENCY_WEIGHT = true

/** trendScore ≥ … → klarer Aufwärtstrend */
export const TREND_CLEAR_UP_MIN = 0.45
/** … → leicht aufwärts */
export const TREND_SLIGHT_UP_MIN = 0.15
/** … → leicht abwärts (unterhalb negativ) */
export const TREND_SLIGHT_DOWN_MAX = -0.15
/** … → klarer Abwärtstrend */
export const TREND_CLEAR_DOWN_MAX = -0.45

export type TrendGrade =
  | 'up'
  | 'slight-up'
  | 'stable'
  | 'slight-down'
  | 'down'

export interface TeamTrend {
  teamId: number
  sampleSize: number
  /** Intern: Mittel der Überperformance (Pkt./Spiel). Nicht in der UI. */
  trendScore: number
  /** null wenn !reliable */
  grade: TrendGrade | null
  /**
   * false bei zu wenigen Spielen / Liga-Daten — UI: „noch kein Trend“.
   */
  reliable: boolean
}

export function gradeFromTrendScore(score: number): TrendGrade {
  if (score >= TREND_CLEAR_UP_MIN) return 'up'
  if (score >= TREND_SLIGHT_UP_MIN) return 'slight-up'
  if (score <= TREND_CLEAR_DOWN_MAX) return 'down'
  if (score <= TREND_SLIGHT_DOWN_MAX) return 'slight-down'
  return 'stable'
}

export function trendGradeLabel(grade: TrendGrade): string {
  switch (grade) {
    case 'up':
      return 'Aufwärtstrend'
    case 'slight-up':
      return 'leicht aufwärts'
    case 'stable':
      return 'stabil'
    case 'slight-down':
      return 'leicht abwärts'
    case 'down':
      return 'Abwärtstrend'
  }
}

export function trendGradeArrow(grade: TrendGrade): string {
  switch (grade) {
    case 'up':
    case 'slight-up':
      return '↑'
    case 'down':
    case 'slight-down':
      return '↓'
    case 'stable':
      return '→'
  }
}

function expectedPointsFromFocus(pWin: number, pDraw: number): number {
  return pWin * 3 + pDraw * 1
}

function actualPoints(focusGoals: number, oppGoals: number): number {
  if (focusGoals > oppGoals) return 3
  if (focusGoals < oppGoals) return 0
  return 1
}

function recencyWeights(n: number): number[] {
  if (!TREND_USE_RECENCY_WEIGHT || n <= 1) {
    return Array.from({ length: n }, () => 1 / n)
  }
  // Index 0 = ältestes der N Spiele, n-1 = jüngstes
  const raw = Array.from({ length: n }, (_, i) => i + 1)
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((w) => w / sum)
}

/** Abgeschlossene Spiele des Vereins, älteste zuerst (innerhalb der Fenster-Auswahl). */
export function recentFinishedMatchesForTeam(
  teamId: number,
  matches: Match[],
  opts?: { window?: number; maxMatchday?: number | null },
): Match[] {
  const window = opts?.window ?? TREND_WINDOW
  const maxMd = opts?.maxMatchday
  const finished = matches.filter((m) => {
    if (!m.matchIsFinished) return false
    if (m.team1.teamId !== teamId && m.team2.teamId !== teamId) return false
    if (maxMd != null && m.group.groupOrderID > maxMd) return false
    return finalResult(m) != null
  })
  finished.sort(
    (a, b) =>
      b.group.groupOrderID - a.group.groupOrderID || b.matchID - a.matchID,
  )
  const recent = finished.slice(0, window)
  recent.reverse() // älteste → jüngste für Recency-Gewichte
  return recent
}

/**
 * Form-Trend eines Vereins: Überperformance gegen die Poisson-Erwartung
 * der jeweiligen Gegner (aktuelle Tabellen-Stärken, wie Härte/Spielschätzung).
 */
export function computeTeamTrend(
  teamId: number,
  matches: Match[],
  standings: StandingRow[],
  opts?: {
    window?: number
    maxMatchday?: number | null
    precomputedStrengths?: ReturnType<typeof deriveTeamStrengths>
  },
): TeamTrend {
  const window = opts?.window ?? TREND_WINDOW
  const teamRow = standings.find((s) => s.teamId === teamId)
  const leagueOk = hasEnoughData(standings)
  const recent = recentFinishedMatchesForTeam(teamId, matches, {
    window,
    maxMatchday: opts?.maxMatchday,
  })
  const sampleSize = recent.length
  const teamPlayedOk = (teamRow?.played ?? 0) >= window && sampleSize >= window

  if (!leagueOk || !teamPlayedOk) {
    return {
      teamId,
      sampleSize,
      trendScore: 0,
      grade: null,
      reliable: false,
    }
  }

  const { strengths, avgDefense } =
    opts?.precomputedStrengths ?? deriveTeamStrengths(standings)

  const deltas: number[] = []
  for (const m of recent) {
    const end = finalResult(m)!
    const home = m.team1.teamId === teamId
    const homeStr =
      strengths.get(m.team1.teamId) ?? {
        teamId: m.team1.teamId,
        attack: DEFAULT_ATTACK,
        defense: DEFAULT_DEFENSE,
      }
    const awayStr =
      strengths.get(m.team2.teamId) ?? {
        teamId: m.team2.teamId,
        attack: DEFAULT_ATTACK,
        defense: DEFAULT_DEFENSE,
      }
    const pred = predictMatch(homeStr, awayStr, avgDefense, { reliable: true })
    const expected = home
      ? expectedPointsFromFocus(pred.pHome, pred.pDraw)
      : expectedPointsFromFocus(pred.pAway, pred.pDraw)
    const focusGoals = home ? end.pointsTeam1 : end.pointsTeam2
    const oppGoals = home ? end.pointsTeam2 : end.pointsTeam1
    const actual = actualPoints(focusGoals, oppGoals)
    deltas.push(actual - expected)
  }

  const weights = recencyWeights(deltas.length)
  let trendScore = 0
  for (let i = 0; i < deltas.length; i++) {
    trendScore += deltas[i]! * weights[i]!
  }

  return {
    teamId,
    sampleSize,
    trendScore,
    grade: gradeFromTrendScore(trendScore),
    reliable: true,
  }
}

/** Trends für mehrere Vereine — Stärken einmal ableiten. */
export function computeTeamTrends(
  teamIds: readonly number[],
  matches: Match[],
  standings: StandingRow[],
  opts?: { window?: number; maxMatchday?: number | null },
): Map<number, TeamTrend> {
  const precomputedStrengths = deriveTeamStrengths(standings)
  const map = new Map<number, TeamTrend>()
  for (const id of teamIds) {
    map.set(
      id,
      computeTeamTrend(id, matches, standings, {
        ...opts,
        precomputedStrengths,
      }),
    )
  }
  return map
}
