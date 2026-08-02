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
import {
  AWAY_WEIGHT,
  DEFAULT_PPG,
  HOME_WEIGHT,
  computeScheduleHardness,
  hardnessTone,
  remainingStrength,
  remainingStrengthRaw,
} from './schedule'

describe('remainingStrengthRaw', () => {
  it('mittelt gewichtetes Gegner-PPG über Restspiele (Mini-Liga ST2)', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES)
    const raw = remainingStrengthRaw(MINI_LEAGUE_OPEN, standings)

    // Nach ST1: Alpha 3/1=3, Delta 1/1=1, Gamma 1/1=1, Beta 0/1=0
    // Alpha (Heim vs Gamma): 1 * HOME_WEIGHT
    expect(raw.get(TEAM_ALPHA.teamId)?.raw).toBeCloseTo(1 * HOME_WEIGHT)
    expect(raw.get(TEAM_ALPHA.teamId)?.remainingGames).toBe(1)
    // Gamma (Auswärts vs Alpha): 3 * AWAY_WEIGHT
    expect(raw.get(TEAM_GAMMA.teamId)?.raw).toBeCloseTo(3 * AWAY_WEIGHT)
    // Beta (Heim vs Delta): 1 * HOME_WEIGHT
    expect(raw.get(TEAM_BETA.teamId)?.raw).toBeCloseTo(1 * HOME_WEIGHT)
    // Delta (Auswärts vs Beta): 0 * AWAY_WEIGHT
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

describe('remainingStrength', () => {
  it('skaliert auf 0–100: schwerstes Restprogramm → 100', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES)
    const index = remainingStrength(MINI_LEAGUE_OPEN, standings)

    // Gamma trifft Alpha (PPG 3) auswärts → klar schwerstes Programm
    expect(index.get(TEAM_GAMMA.teamId)).toBe(100)
    // Delta trifft Beta (PPG 0) auswärts → leichtestes Restprogramm
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
  it('Rang 1 = schwerstes Restprogramm', () => {
    const standings = buildStandings(MINI_LEAGUE_MATCHES)
    const rows = computeScheduleHardness(MINI_LEAGUE_OPEN, standings)
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
