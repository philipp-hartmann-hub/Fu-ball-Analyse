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
 * Alle Rohwerte gleich → 50 (bei mind. einem Restspiel).
 */

/** Faktor auf Gegner-PPG bei Heimspiel (leichter). */
export const HOME_WEIGHT = 0.9

/** Faktor auf Gegner-PPG bei Auswärtsspiel (schwerer). */
export const AWAY_WEIGHT = 1.1

/** Fallback-PPG, wenn ein Gegner noch 0 Spiele hat. */
export const DEFAULT_PPG = 1.0

export interface ScheduleHardness {
  teamId: number
  /** 0–100, höher = schwerer */
  index: number
  /** 1 = schwerstes Restprogramm der Liga (bei Index-Gleichstand: niedrigere teamId zuerst) */
  rank: number
  /** Mittleres gewichtetes Gegner-PPG */
  raw: number
  remainingGames: number
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

  for (const [teamId, b] of buckets) {
    if (b.remainingGames === 0) {
      index.set(teamId, 0)
    } else if (max === min) {
      index.set(teamId, 50)
    } else {
      index.set(teamId, ((b.raw - min) / (max - min)) * 100)
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

/**
 * Volle Kennzahlen inkl. Liga-Rang (1 = schwerstes Restprogramm).
 */
export function computeScheduleHardness(
  matches: Match[],
  standings: StandingRow[],
): ScheduleHardness[] {
  const buckets = remainingStrengthRaw(matches, standings)
  const index = scaleHardnessIndex(buckets)

  const ordered = [...standings]
    .map((row) => {
      const b = buckets.get(row.teamId)
      return {
        teamId: row.teamId,
        index: index.get(row.teamId) ?? 0,
        raw: b?.raw ?? 0,
        remainingGames: b?.remainingGames ?? 0,
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

/** Tone für UI: leicht / mittel / schwer anhand Index. */
export function hardnessTone(index: number): 'easy' | 'mid' | 'hard' {
  if (index < 35) return 'easy'
  if (index < 65) return 'mid'
  return 'hard'
}
