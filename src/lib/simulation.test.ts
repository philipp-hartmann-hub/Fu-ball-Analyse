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
  forecastZoneBreakdown,
  predictFixture,
  predictMatch,
  primaryForecastZone,
  runSeasonSimulation,
  samplePoisson,
  type TeamStrength,
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
      const breakdown = forecastZoneBreakdown(f, 'bl1')
      expect(breakdown[0]).toEqual(primary)
      expect(breakdown.reduce((s, e) => s + e.probability, 0)).toBeCloseTo(1, 5)
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

describe('predictMatch / predictFixture', () => {
  const equal: TeamStrength = { teamId: 1, attack: 1.3, defense: 1.3 }
  const strongHome: TeamStrength = { teamId: 1, attack: 2.2, defense: 0.9 }
  const weakAway: TeamStrength = { teamId: 2, attack: 0.9, defense: 1.8 }

  it('pHome+pDraw+pAway summieren zu ~1', () => {
    const p = predictMatch(strongHome, weakAway, 1.25)
    expect(p.pHome + p.pDraw + p.pAway).toBeCloseTo(1, 10)
  })

  it('stärkeres Heimteam -> pHome > pAway', () => {
    const p = predictMatch(strongHome, weakAway, 1.25)
    expect(p.pHome).toBeGreaterThan(p.pAway)
  })

  it('gleiche Stärke: leichter Heimvorteil (pHome > pAway)', () => {
    const p = predictMatch(equal, { ...equal, teamId: 2 }, 1.3)
    expect(p.pHome).toBeGreaterThan(p.pAway)
    expect(p.expHome).toBeCloseTo(p.expAway + HOME_ADVANTAGE, 5)
  })

  it('deterministisch: gleiche Eingabe -> gleiche Ausgabe', () => {
    const a = predictMatch(strongHome, weakAway, 1.25)
    const b = predictMatch(strongHome, weakAway, 1.25)
    expect(a).toEqual(b)
  })

  it('reliable===false bei 0-Spiele-Fixture, keine Aussage-Flag', () => {
    const standings = Array.from({ length: 4 }, (_, i) => ({
      teamId: i + 1,
      teamName: `T${i + 1}`,
      shortName: `T${i + 1}`,
      teamIconUrl: '',
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      rank: i + 1,
    }))
    const match = MATCH_MD2_ALPHA_GAMMA
    // Mini-League IDs: map fixture teams onto zero-played standings
    const zero = standings.map((s, i) => ({
      ...s,
      teamId: [TEAM_ALPHA.teamId, TEAM_BETA.teamId, match.team2.teamId, 99][i]!,
    }))
    // Ensure both fixture teams present
    zero[0]!.teamId = match.team1.teamId
    zero[1]!.teamId = match.team2.teamId
    const pred = predictFixture(zero, match)
    expect(pred).not.toBeNull()
    expect(pred!.reliable).toBe(false)
    expect(pred!.lockedScenario).toBeNull()
  })

  it('gesetztes Szenario überschreibt die Vorhersage (lockedScenario)', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const scenario = {
      matchId: MATCH_MD2_ALPHA_GAMMA.matchID,
      homeGoals: 3,
      awayGoals: 1,
    }
    const pred = predictFixture(base, MATCH_MD2_ALPHA_GAMMA, {
      scenarios: [scenario],
    })
    expect(pred!.lockedScenario).toEqual(scenario)
    // Modellwerte bleiben berechenbar
    expect(pred!.pHome + pred!.pDraw + pred!.pAway).toBeCloseTo(1, 10)
  })

  it('likelyScore ist Modus je Seite (floor λ, gecappt)', () => {
    const p = predictMatch(strongHome, weakAway, 1.25)
    expect(p.likelyScore.home).toBe(Math.floor(p.expHome))
    expect(p.likelyScore.away).toBe(Math.floor(p.expAway))
  })
})
