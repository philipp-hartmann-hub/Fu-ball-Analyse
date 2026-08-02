import { describe, expect, it } from 'vitest'
import {
  MATCH_MD2_ALPHA_GAMMA,
  MATCH_MD2_BETA_DELTA,
  MINI_LEAGUE_MATCHES,
  TEAM_ALPHA,
  TEAM_BETA,
} from './__fixtures__/miniLeague'
import {
  HOME_ADVANTAGE,
  createRng,
  deriveTeamStrengths,
  expectedGoals,
  primaryForecastZone,
  runSeasonSimulation,
  samplePoisson,
} from './simulation'
import { buildStandings } from './table'

describe('createRng / samplePoisson', () => {
  it('ist deterministisch bei gleichem Seed', () => {
    const a = createRng(123)
    const b = createRng(123)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('liefert unterschiedliche Folgen bei anderem Seed', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(Array.from({ length: 5 }, () => a())).not.toEqual(
      Array.from({ length: 5 }, () => b()),
    )
  })

  it('samplePoisson bleibt im erlaubten Bereich', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i++) {
      const g = samplePoisson(1.4, rng)
      expect(g).toBeGreaterThanOrEqual(0)
      expect(g).toBeLessThanOrEqual(8)
    }
  })
})

describe('expectedGoals', () => {
  it('gibt Heimvorteil als konstanten Bonus', () => {
    const equal = { teamId: 1, attack: 1.2, defense: 1.2 }
    const { homeLambda, awayLambda } = expectedGoals(equal, equal, 1.2)
    expect(homeLambda).toBeCloseTo(1.2 + HOME_ADVANTAGE, 5)
    expect(awayLambda).toBeCloseTo(1.2, 5)
  })
})

describe('runSeasonSimulation', () => {
  const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
  const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]

  it('stabil bei fixem Seed (gleiche Verteilungen)', () => {
    const a = runSeasonSimulation({
      baseStandings: base,
      remaining,
      league: 'bl1',
      runs: 400,
      seed: 99,
    })
    const b = runSeasonSimulation({
      baseStandings: base,
      remaining,
      league: 'bl1',
      runs: 400,
      seed: 99,
    })
    expect(a).toEqual(b)
    expect(a.teams).toHaveLength(4)
  })

  it('andere Seeds erzeugen andere Rank-Counts', () => {
    const a = runSeasonSimulation({
      baseStandings: base,
      remaining,
      league: 'bl1',
      runs: 300,
      seed: 1,
    })
    const b = runSeasonSimulation({
      baseStandings: base,
      remaining,
      league: 'bl1',
      runs: 300,
      seed: 2,
    })
    const alphaA = a.teams.find((t) => t.teamId === TEAM_ALPHA.teamId)!
    const alphaB = b.teams.find((t) => t.teamId === TEAM_ALPHA.teamId)!
    expect(alphaA.rankCounts).not.toEqual(alphaB.rankCounts)
  })

  it('Zonenwahrscheinlichkeiten summieren sich zu ~1', () => {
    const result = runSeasonSimulation({
      baseStandings: base,
      remaining,
      league: 'bl1',
      runs: 500,
      seed: 5,
    })
    for (const team of result.teams) {
      const sum = Object.values(team.zoneProbabilities).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 5)
      expect(team.medianRank).toBeGreaterThanOrEqual(1)
      expect(team.medianRank).toBeLessThanOrEqual(4)
    }
  })

  it('ohne Restspiele: aktueller Rang mit 100%', () => {
    const result = runSeasonSimulation({
      baseStandings: base,
      remaining: [],
      league: 'bl1',
      runs: 1,
      seed: 1,
    })
    for (const row of base) {
      const f = result.teams.find((t) => t.teamId === row.teamId)!
      expect(f.medianRank).toBe(row.rank)
      expect(f.expectedPoints).toBe(row.points)
      const primary = primaryForecastZone(f, 'bl1')
      expect(primary.probability).toBe(1)
    }
  })

  it('respektiert feste Szenarien (kein Zufall für dieses Spiel)', () => {
    const locked = runSeasonSimulation({
      baseStandings: base,
      remaining,
      league: 'bl1',
      fixedScenarios: [
        { matchId: MATCH_MD2_ALPHA_GAMMA.matchID, homeGoals: 5, awayGoals: 0 },
        { matchId: MATCH_MD2_BETA_DELTA.matchID, homeGoals: 0, awayGoals: 0 },
      ],
      runs: 80,
      seed: 3,
    })
    const alpha = locked.teams.find((t) => t.teamId === TEAM_ALPHA.teamId)!
    // Alpha hat mit 5:0 und Remis Beta-Delta immer 6 Punkte und Platz 1
    expect(alpha.medianRank).toBe(1)
    expect(alpha.expectedPoints).toBe(6)
    expect(alpha.rankCounts[0]).toBe(80)
  })

  it('deriveTeamStrengths nutzt Tore/Spiele', () => {
    const { strengths } = deriveTeamStrengths(base)
    const alpha = strengths.get(TEAM_ALPHA.teamId)!
    const beta = strengths.get(TEAM_BETA.teamId)!
    expect(alpha.attack).toBeCloseTo(2, 5)
    expect(beta.defense).toBeCloseTo(2, 5)
  })
})
