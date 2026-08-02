import type { Match, StandingRow } from '../types'

/**
 * Restprogramm-Härte
 *
 * Definition: Durchschnittliche Stärke der verbleibenden Gegner.
 * Gegner-Stärke = aktuelle Punkte pro Spiel (PPG) aus `standings`.
 * Gewichtung Heim/Auswärts (Heim etwas leichter, Auswärts etwas schwerer):
 *   - Heimspiel:  Gegner-PPG × HOME_WEIGHT
 *   - Auswärts:   Gegner-PPG × AWAY_WEIGHT
 * Rohwert = Mittel der gewichteten Gegner-PPG über alle Restspiele des Vereins
 * (nur Spiele, in denen der Verein vorkommt; `matches` = offene/Rest-Fixtures).
 *
 * Index 0–100: lineare Skalierung innerhalb der Liga (Min → 0, Max → 100).
 * Höher = schwereres Restprogramm. Ohne Restspiele → 0.
 * Rohwerte praktisch gleich ((max−min) < EQUALITY_EPS) → alle aktiven Teams 50.
 *
 * Aussagekraft: Median der bisher gespielten Spiele muss ≥ MIN_GAMES_FOR_HARDNESS
 * sein (`reliable`). Sonst Index/Rang ohne Einstufung in der UI.
 */

/** Faktor auf Gegner-PPG bei Heimspiel (leichter). */
export const HOME_WEIGHT = 0.9

/** Faktor auf Gegner-PPG bei Auswärtsspiel (schwerer). */
export const AWAY_WEIGHT = 1.1

/** Fallback-PPG, wenn ein Gegner noch 0 Spiele hat. */
export const DEFAULT_PPG = 1.0

/**
 * Unter dieser Spread-Schwelle gelten Rohwerte als gleich → Index 50
 * (verhindert 0–100-Aufblasen von Fließkomma-Rauschen).
 */
export const EQUALITY_EPS = 1e-9

/**
 * Median gespielter Spiele in der Liga muss mindestens so hoch sein,
 * bevor die Härte als aussagekräftig gilt (PPG sonst zu verrauscht).
 */
export const MIN_GAMES_FOR_HARDNESS = 5

export interface ScheduleHardness {
  teamId: number
  /** 0–100, höher = schwerer; bei gleichen Rohwerten 50 */
  index: number
  /** 1 = schwerstes Restprogramm der Liga (bei Index-Gleichstand: niedrigere teamId zuerst) */
  rank: number
  /** Mittleres gewichtetes Gegner-PPG */
  raw: number
  remainingGames: number
  /**
   * false, wenn noch zu wenige Spiele gespielt sind (Median &lt; MIN_GAMES_FOR_HARDNESS)
   * — Index/Rang dann nicht als Ranking interpretieren.
   */
  reliable: boolean
}

function opponentPpg(
  opponentId: number,
  ppgByTeam: Map<number, number>,
): number {
  return ppgByTeam.get(opponentId) ?? DEFAULT_PPG
}

export interface StrengthBucket {
  /** Mittleres gewichtetes Gegner-PPG (0 wenn keine Restspiele). */
  raw: number
  remainingGames: number
}

/**
 * Rohwerte inkl. Restspiel-Anzahl je Verein.
 */
export function remainingStrengthRaw(
  matches: Match[],
  standings: StandingRow[],
): Map<number, StrengthBucket> {
  const ppgByTeam = new Map<number, number>()
  for (const row of standings) {
    ppgByTeam.set(
      row.teamId,
      row.played > 0 ? row.points / row.played : DEFAULT_PPG,
    )
  }

  const sums = new Map<number, { sum: number; n: number }>()
  for (const row of standings) {
    sums.set(row.teamId, { sum: 0, n: 0 })
  }

  for (const m of matches) {
    const homeId = m.team1.teamId
    const awayId = m.team2.teamId

    const homeBucket = sums.get(homeId)
    if (homeBucket) {
      homeBucket.sum += opponentPpg(awayId, ppgByTeam) * HOME_WEIGHT
      homeBucket.n += 1
    }

    const awayBucket = sums.get(awayId)
    if (awayBucket) {
      awayBucket.sum += opponentPpg(homeId, ppgByTeam) * AWAY_WEIGHT
      awayBucket.n += 1
    }
  }

  const out = new Map<number, StrengthBucket>()
  for (const [teamId, { sum, n }] of sums) {
    out.set(teamId, {
      raw: n > 0 ? sum / n : 0,
      remainingGames: n,
    })
  }
  return out
}

/**
 * Skaliert Rohwerte linear auf 0–100 innerhalb der Liga.
 * Nur Teams mit Restspielen fließen in Min/Max ein (auch bei Rohwert 0);
 * ohne Restspiele → Index 0.
 * Bei (max − min) &lt; EQUALITY_EPS → alle aktiven Teams auf 50 (kein Rauschen-Ranking).
 */
export function scaleHardnessIndex(
  buckets: Map<number, StrengthBucket>,
): Map<number, number> {
  const active = [...buckets.entries()].filter(([, b]) => b.remainingGames > 0)
  const index = new Map<number, number>()

  if (active.length === 0) {
    for (const teamId of buckets.keys()) index.set(teamId, 0)
    return index
  }

  let min = Infinity
  let max = -Infinity
  for (const [, b] of active) {
    if (b.raw < min) min = b.raw
    if (b.raw > max) max = b.raw
  }

  const spread = max - min
  const allEqual = spread < EQUALITY_EPS

  for (const [teamId, b] of buckets) {
    if (b.remainingGames === 0) {
      index.set(teamId, 0)
    } else if (allEqual) {
      index.set(teamId, 50)
    } else {
      index.set(teamId, ((b.raw - min) / spread) * 100)
    }
  }
  return index
}

/**
 * Restprogramm-Härte als Index 0–100 (höher = schwerer).
 * `matches` = Restfixtures, `standings` = aktuelle Tabelle für PPG.
 */
export function remainingStrength(
  matches: Match[],
  standings: StandingRow[],
): Map<number, number> {
  return scaleHardnessIndex(remainingStrengthRaw(matches, standings))
}

/** Median der `played`-Werte; leere Liga → 0. */
export function medianGamesPlayed(standings: StandingRow[]): number {
  if (standings.length === 0) return 0
  const sorted = standings.map((s) => s.played).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Volle Kennzahlen inkl. Liga-Rang (1 = schwerstes Restprogramm).
 * `reliable` nur wenn Median gespielter Spiele ≥ MIN_GAMES_FOR_HARDNESS.
 */
export function computeScheduleHardness(
  matches: Match[],
  standings: StandingRow[],
): ScheduleHardness[] {
  const buckets = remainingStrengthRaw(matches, standings)
  const index = scaleHardnessIndex(buckets)
  const reliable = medianGamesPlayed(standings) >= MIN_GAMES_FOR_HARDNESS

  const ordered = [...standings]
    .map((row) => {
      const b = buckets.get(row.teamId)
      return {
        teamId: row.teamId,
        index: index.get(row.teamId) ?? 0,
        raw: b?.raw ?? 0,
        remainingGames: b?.remainingGames ?? 0,
        reliable,
      }
    })
    .sort((a, b) => {
      // Ohne Restspiele ans Ende
      if (a.remainingGames === 0 && b.remainingGames > 0) return 1
      if (b.remainingGames === 0 && a.remainingGames > 0) return -1
      if (b.index !== a.index) return b.index - a.index
      return a.teamId - b.teamId
    })

  return ordered.map((row, i) => ({
    ...row,
    rank: i + 1,
  }))
}

/** Tone für UI: leicht / mittel / schwer anhand Index (nur bei reliable verwenden). */
export function hardnessTone(index: number): 'easy' | 'mid' | 'hard' {
  if (index < 35) return 'easy'
  if (index < 65) return 'mid'
  return 'hard'
}
