import { describe, expect, it } from 'vitest'
import {
  MINI_LEAGUE_MATCHES,
  MINI_LEAGUE_OPEN,
  TEAM_ALPHA,
  TEAM_BETA,
  TEAM_DELTA,
  TEAM_GAMMA,
} from './__fixtures__/miniLeague'
import { buildStandings, remainingMatches } from './table'
import type { StandingRow } from '../types'
import {
  AWAY_WEIGHT,
  DEFAULT_PPG,
  HOME_WEIGHT,
  MIN_GAMES_FOR_HARDNESS,
  computeScheduleHardness,
  hardnessTone,
  remainingStrength,
  remainingStrengthRaw,
  scaleHardnessIndex,
  type StrengthBucket,
} from './schedule'

describe('remainingStrengthRaw', () => {
  it('mittelt gewichtetes Gegner-PPG über Restspiele (Mini-Liga ST2)', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES)
    const raw = remainingStrengthRaw(MINI_LEAGUE_OPEN, standings)

    expect(raw.get(TEAM_ALPHA.teamId)?.raw).toBeCloseTo(1 * HOME_WEIGHT)
    expect(raw.get(TEAM_ALPHA.teamId)?.remainingGames).toBe(1)
    expect(raw.get(TEAM_GAMMA.teamId)?.raw).toBeCloseTo(3 * AWAY_WEIGHT)
    expect(raw.get(TEAM_BETA.teamId)?.raw).toBeCloseTo(1 * HOME_WEIGHT)
    expect(raw.get(TEAM_DELTA.teamId)?.raw).toBeCloseTo(0 * AWAY_WEIGHT)
    expect(raw.get(TEAM_DELTA.teamId)?.remainingGames).toBe(1)
  })

  it('nutzt DEFAULT_PPG wenn Gegner 0 Spiele hat', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES).map((r) => ({
      ...r,
      played: 0,
      points: 0,
    }))
    const raw = remainingStrengthRaw(MINI_LEAGUE_OPEN, standings)
    expect(raw.get(TEAM_ALPHA.teamId)?.raw).toBeCloseTo(DEFAULT_PPG * HOME_WEIGHT)
    expect(raw.get(TEAM_GAMMA.teamId)?.raw).toBeCloseTo(DEFAULT_PPG * AWAY_WEIGHT)
  })

  it('respektiert remainingMatches-Cutoff', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const open = remainingMatches(MINI_LEAGUE_MATCHES, 1)
    expect(open).toHaveLength(2)
    const raw = remainingStrengthRaw(open, standings)
    expect(raw.get(TEAM_ALPHA.teamId)?.remainingGames).toBe(1)
    expect([...raw.values()].every((b) => Number.isFinite(b.raw))).toBe(true)
  })
})

describe('scaleHardnessIndex', () => {
  it('Saisonstart / identische Rohwerte → Index 50 für alle aktiven Teams', () => {
    const base = DEFAULT_PPG // typischer Mittelwert bei balanced H/A
    const buckets = new Map<number, StrengthBucket>([
      [1, { raw: base, remainingGames: 34 }],
      [2, { raw: base, remainingGames: 34 }],
      [3, { raw: base, remainingGames: 34 }],
      [4, { raw: base, remainingGames: 34 }],
    ])
    const index = scaleHardnessIndex(buckets)
    expect([...index.values()].every((v) => v === 50)).toBe(true)
  })

  it('Fließkomma-Rauschen bläst nicht auf 0–100 auf', () => {
    // Gleiche Summe, andere Additionsreihenfolge → mikroskopische Differenzen
    const a = 0.1 + 0.2 + 0.3
    const b = 0.3 + 0.2 + 0.1
    const c = 0.2 + 0.1 + 0.3
    expect(a).not.toBe(b) // oft true bei IEEE-754; egal wenn doch gleich
    const buckets = new Map<number, StrengthBucket>([
      [1, { raw: a, remainingGames: 10 }],
      [2, { raw: b, remainingGames: 10 }],
      [3, { raw: c, remainingGames: 10 }],
    ])
    const index = scaleHardnessIndex(buckets)
    expect([...index.values()].every((v) => v === 50)).toBe(true)
    expect(Math.max(...index.values()) - Math.min(...index.values())).toBe(0)
  })
})

describe('remainingStrength', () => {
  it('skaliert auf 0–100: schwerstes Restprogramm → 100', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES)
    const index = remainingStrength(MINI_LEAGUE_OPEN, standings)

    expect(index.get(TEAM_GAMMA.teamId)).toBe(100)
    expect(index.get(TEAM_DELTA.teamId)).toBe(0)
    expect(index.get(TEAM_ALPHA.teamId)!).toBeGreaterThan(0)
    expect(index.get(TEAM_ALPHA.teamId)!).toBeLessThan(100)
  })

  it('gibt 0 für Teams ohne Restspiele', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES)
    const index = remainingStrength([], standings)
    expect([...index.values()].every((v) => v === 0)).toBe(true)
  })
})

describe('computeScheduleHardness', () => {
  it('Saisonstart (0 Spiele): reliable:false und Index 50 bei gleichen Rohwerten', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES).map((r) => ({
      ...r,
      played: 0,
      points: 0,
      won: 0,
      draw: 0,
      lost: 0,
    }))
    const rows = computeScheduleHardness(MINI_LEAGUE_OPEN, standings)
    expect(rows.every((r) => r.reliable === false)).toBe(true)

    // Identische Restprogramm-Rohwerte (balanced) → alle Index 50, kein 0/100
    const equalBuckets = new Map(
      standings.map((s) => [
        s.teamId,
        { raw: DEFAULT_PPG, remainingGames: 34 },
      ]),
    )
    const index = scaleHardnessIndex(equalBuckets)
    expect([...index.values()].every((v) => v === 50)).toBe(true)
    expect(Math.min(...index.values())).not.toBe(0)
    expect(Math.max(...index.values())).not.toBe(100)
  })

  it('zu wenige Spiele (unter Median-Schwelle): reliable:false', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES)
    expect(standings.every((s) => s.played < MIN_GAMES_FOR_HARDNESS)).toBe(true)
    const rows = computeScheduleHardness(MINI_LEAGUE_OPEN, standings)
    expect(rows.every((r) => !r.reliable)).toBe(true)
    // Ranking-Zahlen existieren weiter, sollen UI aber nicht als Aussage nutzen
    expect(rows[0].teamId).toBe(TEAM_GAMMA.teamId)
  })

  it('genug Spiele, unterschiedliche Stärken: reliable:true, plausible Rangfolge', () => {
    const standings: StandingRow[] = buildStandings(MINI_LEAGUE_MATCHES).map((r) => {
      // Median ≥ 5: alle auf 5+ Spiele setzen, PPG-Verhältnisse beibehalten
      const played = 10
      const ppg =
        r.teamId === TEAM_ALPHA.teamId
          ? 2.2
          : r.teamId === TEAM_DELTA.teamId
            ? 1.5
            : r.teamId === TEAM_GAMMA.teamId
              ? 1.2
              : 0.8
      const points = Math.round(ppg * played)
      return { ...r, played, points }
    })
    const rows = computeScheduleHardness(MINI_LEAGUE_OPEN, standings)
    expect(rows.every((r) => r.reliable)).toBe(true)
    // Gamma trifft Alpha (hohe PPG) auswärts → Rang 1
    expect(rows[0].teamId).toBe(TEAM_GAMMA.teamId)
    expect(rows[0].rank).toBe(1)
    expect(rows[0].index).toBe(100)
    expect(rows.find((r) => r.teamId === TEAM_DELTA.teamId)?.rank).toBe(4)
  })
})

describe('hardnessTone', () => {
  it('ordnet Index in leicht/mittel/schwer', () => {
    expect(hardnessTone(10)).toBe('easy')
    expect(hardnessTone(50)).toBe('mid')
    expect(hardnessTone(80)).toBe('hard')
  })
})
