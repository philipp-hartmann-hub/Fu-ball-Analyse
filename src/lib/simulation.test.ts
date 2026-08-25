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
  MATCH_LEAN_LIKELY_THRESHOLD,
  createRng,
  deriveMatchLean,
  deriveTeamStrengths,
  deriveTeamStrengthsRaw,
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

  it('deriveTeamStrengths nutzt Tore/Spiele (Flag false = roh)', () => {
    const { strengths } = deriveTeamStrengths(base, [], { adjusted: false })
    const alpha = strengths.get(TEAM_ALPHA.teamId)!
    const beta = strengths.get(TEAM_BETA.teamId)!
    expect(alpha.attack).toBeCloseTo(2, 5)
    expect(beta.defense).toBeCloseTo(2, 5)
  })
})

describe('deriveTeamStrengths (gegner-adjustiert)', () => {
  function team(id: number, name: string): import('../types').TeamInfo {
    return {
      teamId: id,
      teamName: name,
      shortName: name,
      teamIconUrl: '',
    }
  }

  function finished(
    matchID: number,
    day: number,
    home: import('../types').TeamInfo,
    away: import('../types').TeamInfo,
    hg: number,
    ag: number,
  ): import('../types').Match {
    return {
      matchID,
      matchDateTime: '2025-09-01T15:30:00',
      matchDateTimeUTC: '2025-09-01T13:30:00Z',
      leagueName: 'Test',
      leagueSeason: 2025,
      leagueShortcut: 't',
      lastUpdateDateTime: '2025-09-01T17:00:00',
      group: {
        groupName: `${day}. Spieltag`,
        groupOrderID: day,
        groupID: day,
      },
      team1: home,
      team2: away,
      matchIsFinished: true,
      matchResults: [
        {
          resultID: 2,
          resultName: 'Endergebnis',
          pointsTeam1: hg,
          pointsTeam2: ag,
          resultOrderID: 2,
          resultTypeID: 2,
        },
      ],
      goals: [],
    }
  }

  /**
   * Leverkusen-Fall: gleiche Rohtore, aber A nur gegen schwache Abwehr,
   * B gegen starke — B muss höhere attack bekommen.
   */
  it('Leverkusen: gleiche Rohtore, stärkere Gegner → höhere attack', () => {
    const A = team(1, 'Inflated')
    const B = team(2, 'Solid')
    const W = team(3, 'WeakDef')
    const S = team(4, 'StrongDef')
    const M = team(5, 'Mid')

    const matches: import('../types').Match[] = []
    let id = 1
    let day = 1
    // A schießt 3 pro Spiel nur gegen WeakDef (5 Spiele → 15 Tore)
    for (let i = 0; i < 5; i++) {
      matches.push(finished(id++, day++, A, W, 3, 0))
    }
    // B schießt 3 pro Spiel nur gegen StrongDef
    for (let i = 0; i < 5; i++) {
      matches.push(finished(id++, day++, B, S, 3, 0))
    }
    // WeakDef kassiert zusätzlich von Mid viele Tore → schwache Abwehr
    for (let i = 0; i < 5; i++) {
      matches.push(finished(id++, day++, M, W, 4, 0))
    }
    // StrongDef hält Mid klein → starke Abwehr
    for (let i = 0; i < 5; i++) {
      matches.push(finished(id++, day++, M, S, 0, 1))
    }
    // Mid vs Mid filler nicht nötig; Standings aus Matches
    const standings = buildStandings(matches)
    const { strengths } = deriveTeamStrengths(standings, matches, {
      adjusted: true,
      shrinkK: 0.5,
    })
    const atkA = strengths.get(A.teamId)!.attack
    const atkB = strengths.get(B.teamId)!.attack
    expect(standings.find((s) => s.teamId === A.teamId)!.goalsFor).toBe(
      standings.find((s) => s.teamId === B.teamId)!.goalsFor,
    )
    expect(atkB).toBeGreaterThan(atkA)
  })

  it('Leverkusen analog defense: wenige Gegentore gegen schwache Angriffe ≠ Top-Abwehr', () => {
    const Soft = team(1, 'Soft')
    const Hard = team(2, 'Hard')
    const WeakAtk = team(3, 'WeakAtk')
    const StrongAtk = team(4, 'StrongAtk')
    const M = team(5, 'Mid')

    const matches: import('../types').Match[] = []
    let id = 1
    let day = 1
    // Soft kassiert je 1 gegen WeakAtk (5×) — „gute“ Roh-Defense
    for (let i = 0; i < 5; i++) {
      matches.push(finished(id++, day++, Soft, WeakAtk, 1, 1))
    }
    // Hard kassiert je 1 gegen StrongAtk (5×) — gleiche Roh-GA
    for (let i = 0; i < 5; i++) {
      matches.push(finished(id++, day++, Hard, StrongAtk, 1, 1))
    }
    // WeakAtk schießt kaum gegen Mid
    for (let i = 0; i < 5; i++) {
      matches.push(finished(id++, day++, WeakAtk, M, 0, 2))
    }
    // StrongAtk schießt viel gegen Mid
    for (let i = 0; i < 5; i++) {
      matches.push(finished(id++, day++, StrongAtk, M, 3, 0))
    }

    const standings = buildStandings(matches)
    const softRow = standings.find((s) => s.teamId === Soft.teamId)!
    const hardRow = standings.find((s) => s.teamId === Hard.teamId)!
    expect(softRow.goalsAgainst / softRow.played).toBeCloseTo(
      hardRow.goalsAgainst / hardRow.played,
      5,
    )

    const { strengths } = deriveTeamStrengths(standings, matches, {
      adjusted: true,
      shrinkK: 0.5,
    })
    // Niedrigerer defense-Wert = bessere Abwehr (weniger erwartete Gegentore)
    expect(strengths.get(Hard.teamId)!.defense).toBeLessThan(
      strengths.get(Soft.teamId)!.defense,
    )
  })

  it('Determinismus und Konvergenz', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const played = MINI_LEAGUE_MATCHES.filter((m) => m.matchIsFinished)
    const a = deriveTeamStrengths(base, played, { adjusted: true })
    const b = deriveTeamStrengths(base, played, { adjusted: true })
    expect(a).toEqual(b)
    for (const s of a.strengths.values()) {
      expect(Number.isFinite(s.attack)).toBe(true)
      expect(Number.isFinite(s.defense)).toBe(true)
      expect(s.attack).toBeGreaterThan(0)
      expect(s.defense).toBeGreaterThan(0)
    }
  })

  it('Normierung: mittlere attack/defense ≈ Ligamittel (vor Shrinkage, shrinkK=0)', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const played = MINI_LEAGUE_MATCHES.filter((m) => m.matchIsFinished)
    const teamGames = base.reduce((s, r) => s + r.played, 0)
    const leagueAvg =
      teamGames > 0
        ? base.reduce((s, r) => s + r.goalsFor, 0) / teamGames
        : 0
    const { strengths } = deriveTeamStrengths(base, played, {
      adjusted: true,
      shrinkK: 0,
    })
    let aSum = 0
    let dSum = 0
    let n = 0
    for (const s of strengths.values()) {
      aSum += s.attack
      dSum += s.defense
      n += 1
    }
    expect(aSum / n).toBeCloseTo(leagueAvg, 5)
    expect(dSum / n).toBeCloseTo(leagueAvg, 5)
  })

  it('Shrinkage: wenige Spiele → nahe am Ligamittel; viele → Adjustierung', () => {
    const A = team(1, 'A')
    const B = team(2, 'B')
    const C = team(3, 'C')
    const D = team(4, 'D')
    // Ein Spiel: A schießt 5 gegen B
    const few = [
      finished(1, 1, A, B, 5, 0),
      finished(2, 1, C, D, 1, 1),
    ]
    const standingsFew = buildStandings(few)
    const fewResult = deriveTeamStrengths(standingsFew, few, {
      adjusted: true,
      shrinkK: 20,
    })
    const leagueFew =
      standingsFew.reduce((s, r) => s + r.goalsFor, 0) /
      standingsFew.reduce((s, r) => s + r.played, 0)
    const fewAtk = fewResult.strengths.get(A.teamId)!.attack
    expect(Math.abs(fewAtk - leagueFew)).toBeLessThan(0.35)

    // Viele Spiele A vs schwache B
    const many: import('../types').Match[] = []
    for (let i = 0; i < 20; i++) {
      many.push(finished(100 + i, i + 1, A, B, 5, 0))
      many.push(finished(200 + i, i + 1, C, D, 1, 1))
    }
    const standingsMany = buildStandings(many)
    const manyResult = deriveTeamStrengths(standingsMany, many, {
      adjusted: true,
      shrinkK: 5,
    })
    const leagueMany =
      standingsMany.reduce((s, r) => s + r.goalsFor, 0) /
      standingsMany.reduce((s, r) => s + r.played, 0)
    const manyAtk = manyResult.strengths.get(A.teamId)!.attack
    // Mit vielen Spielen weiter vom Ligamittel als mit Shrinkage bei 1 Spiel
    expect(Math.abs(manyAtk - leagueMany)).toBeGreaterThan(
      Math.abs(fewAtk - leagueFew),
    )
    expect(manyAtk).toBeGreaterThan(fewAtk)
  })

  it('Prior-Andockpunkt: früh Richtung priorStrength statt Ligamittel', () => {
    const A = team(1, 'A')
    const B = team(2, 'B')
    const C = team(3, 'C')
    const D = team(4, 'D')
    const matches = [
      finished(1, 1, A, B, 1, 0),
      finished(2, 1, C, D, 1, 1),
    ]
    const standings = buildStandings(matches)
    const prior = new Map([
      [A.teamId, { attack: 2.5, defense: 0.8 }],
    ])
    const withPrior = deriveTeamStrengths(standings, matches, {
      adjusted: true,
      shrinkK: 10,
      priorStrength: prior,
    })
    const without = deriveTeamStrengths(standings, matches, {
      adjusted: true,
      shrinkK: 10,
    })
    expect(withPrior.strengths.get(A.teamId)!.attack).toBeGreaterThan(
      without.strengths.get(A.teamId)!.attack,
    )
    expect(withPrior.strengths.get(A.teamId)!.attack).toBeGreaterThan(1.5)
  })

  it('Flag false reproduziert exakt die rohen Werte', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const played = MINI_LEAGUE_MATCHES.filter((m) => m.matchIsFinished)
    const raw = deriveTeamStrengthsRaw(base)
    const flagged = deriveTeamStrengths(base, played, { adjusted: false })
    expect(flagged).toEqual(raw)
  })

  it('Interface: predictMatch/expectedGoals laufen mit adjustierten Stärken', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const played = MINI_LEAGUE_MATCHES.filter((m) => m.matchIsFinished)
    const { strengths, avgDefense } = deriveTeamStrengths(base, played, {
      adjusted: true,
    })
    const home = strengths.get(TEAM_ALPHA.teamId)!
    const away = strengths.get(TEAM_BETA.teamId)!
    const eg = expectedGoals(home, away, avgDefense)
    expect(eg.homeLambda).toBeGreaterThan(0)
    const pred = predictMatch(home, away, avgDefense)
    expect(pred.pHome + pred.pDraw + pred.pAway).toBeCloseTo(1, 10)
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

describe('deriveMatchLean', () => {
  const strongHome: TeamStrength = { teamId: 1, attack: 2.2, defense: 0.9 }
  const weakAway: TeamStrength = { teamId: 2, attack: 0.9, defense: 1.8 }

  it('nimmt den höchsten Ausgang aus Vereinssicht', () => {
    const p = predictMatch(strongHome, weakAway, 1.25)
    const lean = deriveMatchLean(p, 'home')
    expect(lean.reliable).toBe(true)
    expect(lean.locked).toBe(false)
    expect(lean.outcome).toBe('win')
    expect(lean.probability).toBe(p.pHome)
    expect(lean.label).toMatch(/^Sieg /)
  })

  it('ab 50% → wahrscheinlich, darunter → möglich', () => {
    expect(MATCH_LEAN_LIKELY_THRESHOLD).toBe(0.5)
    const likely = deriveMatchLean(
      {
        pHome: 0.55,
        pDraw: 0.25,
        pAway: 0.2,
        likelyScore: { home: 2, away: 1 },
        expHome: 2,
        expAway: 1,
        reliable: true,
        lockedScenario: null,
      },
      'home',
    )
    expect(likely.confidence).toBe('likely')
    expect(likely.label).toBe('Sieg wahrscheinlich')

    const possible = deriveMatchLean(
      {
        pHome: 0.4,
        pDraw: 0.35,
        pAway: 0.25,
        likelyScore: { home: 1, away: 1 },
        expHome: 1.2,
        expAway: 1.1,
        reliable: true,
        lockedScenario: null,
      },
      'home',
    )
    expect(possible.outcome).toBe('win')
    expect(possible.confidence).toBe('possible')
    expect(possible.label).toBe('Sieg möglich')

    const drawLean = deriveMatchLean(
      {
        pHome: 0.3,
        pDraw: 0.42,
        pAway: 0.28,
        likelyScore: { home: 1, away: 1 },
        expHome: 1,
        expAway: 1,
        reliable: true,
        lockedScenario: null,
      },
      'home',
    )
    expect(drawLean.outcome).toBe('draw')
    expect(drawLean.confidence).toBe('possible')
    expect(drawLean.label).toBe('Unentschieden möglich')
  })

  it('Auswärtsperspektive dreht Sieg/Niederlage', () => {
    const lean = deriveMatchLean(
      {
        pHome: 0.6,
        pDraw: 0.2,
        pAway: 0.2,
        likelyScore: { home: 2, away: 0 },
        expHome: 2,
        expAway: 0.8,
        reliable: true,
        lockedScenario: null,
      },
      'away',
    )
    expect(lean.outcome).toBe('loss')
    expect(lean.label).toMatch(/^Niederlage /)
  })

  it('gesetztes Szenario überschreibt das Modell', () => {
    const lean = deriveMatchLean(
      {
        pHome: 0.7,
        pDraw: 0.2,
        pAway: 0.1,
        likelyScore: { home: 2, away: 0 },
        expHome: 2,
        expAway: 0.8,
        reliable: true,
        lockedScenario: {
          matchId: 1,
          homeGoals: 0,
          awayGoals: 1,
        },
      },
      'home',
    )
    expect(lean.locked).toBe(true)
    expect(lean.outcome).toBe('loss')
    expect(lean.label).toBe('gesetzt · Niederlage')
  })
})
