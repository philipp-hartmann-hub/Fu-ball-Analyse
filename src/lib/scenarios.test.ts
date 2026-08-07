import { describe, expect, it } from 'vitest'
import {
  MATCH_MD2_ALPHA_GAMMA,
  MATCH_MD2_BETA_DELTA,
  MINI_LEAGUE_MATCHES,
  TEAM_ALPHA,
} from './__fixtures__/miniLeague'
import {
  EXACT_LIMIT,
  computeExactPositionRanges,
  computeHardBounds,
  computeHardRanges,
  computeNextMatchdayOutlook,
  computePositionRanges,
  computeSeasonOutlook,
  computeTargetMatchdayOutlook,
  deriveExactCaseConditions,
  relevantMatchesForTeam,
  scenarioFromOutcome,
  scenarioFromScore,
  scenariosFromConditions,
  selectRelevantMatches,
  selectRelevantTeamIds,
  simulateExtremeFinishForTest,
} from './scenarios'
import { applyScore, buildStandings, rankStandings } from './table'
import type { Match, MatchOutcome, StandingRow, TeamInfo } from '../types'

describe('scenarioFromScore / Punktevergabe', () => {
  it('clampt Tore auf 0..99', () => {
    expect(scenarioFromScore(1, -5, 150)).toEqual({
      matchId: 1,
      homeGoals: 0,
      awayGoals: 99,
    })
    expect(scenarioFromScore(2, 3.9, 1.2)).toEqual({
      matchId: 2,
      homeGoals: 3,
      awayGoals: 1,
    })
  })

  it('scenarioFromOutcome setzt Grob-Ergebnisse', () => {
    expect(scenarioFromOutcome(1, 'home')).toEqual({
      matchId: 1,
      homeGoals: 1,
      awayGoals: 0,
    })
    expect(scenarioFromOutcome(1, 'draw')).toEqual({
      matchId: 1,
      homeGoals: 0,
      awayGoals: 0,
    })
    expect(scenarioFromOutcome(1, 'away')).toEqual({
      matchId: 1,
      homeGoals: 0,
      awayGoals: 1,
    })
  })

  it('wendet Szenario-Tore korrekt auf die Tabelle an (Sieg/Remis/Niederlage)', () => {
    const win = buildStandings(MINI_LEAGUE_MATCHES, {
      scenarios: [scenarioFromScore(201, 2, 0)],
    })
    expect(win.find((t) => t.teamId === TEAM_ALPHA.teamId)).toMatchObject({
      points: 6,
      won: 2,
      goalDiff: 3,
    })

    const draw = buildStandings(MINI_LEAGUE_MATCHES, {
      scenarios: [scenarioFromScore(201, 1, 1)],
    })
    expect(draw.find((t) => t.teamId === TEAM_ALPHA.teamId)).toMatchObject({
      points: 4,
      draw: 1,
    })

    const loss = buildStandings(MINI_LEAGUE_MATCHES, {
      scenarios: [scenarioFromScore(201, 0, 1)],
    })
    expect(loss.find((t) => t.teamId === TEAM_ALPHA.teamId)).toMatchObject({
      points: 3,
      lost: 1,
      goalDiff: 0,
    })
  })
})

describe('computeNextMatchdayOutlook', () => {
  /**
   * Stand nach ST1 + 2 offene Spiele (Alpha–Gamma, Beta–Delta).
   * Exhaustive 3²=9 Grobergebnisse:
   * Alpha-Sieg oder -Remis → immer Platz 1 (6 von 9).
   * Alpha-Niederlage → Platz 2 oder 3 (Worst = 3).
   */
  it('liefert exakten Best-/Worst-Rang für Alpha bei 2 Spielen', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]

    const outlook = computeNextMatchdayOutlook(base, remaining, TEAM_ALPHA.teamId)

    expect(outlook).not.toBeNull()
    expect(outlook!.matchday).toBe(2)
    expect(outlook!.fixtureCount).toBe(2)
    expect(outlook!.plays).toBe(true)
    expect(outlook!.opponentName).toBe('Gamma')
    expect(outlook!.range).toEqual({
      teamId: TEAM_ALPHA.teamId,
      bestRank: 1,
      worstRank: 3,
      mode: 'exact',
    })
  })

  it('markiert plays=false wenn der Verein nicht spielt', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const outlook = computeNextMatchdayOutlook(
      base,
      [MATCH_MD2_BETA_DELTA],
      TEAM_ALPHA.teamId,
    )
    expect(outlook!.plays).toBe(false)
    expect(outlook!.opponentName).toBeNull()
    expect(outlook!.fixtureCount).toBe(1)
  })

  /**
   * Analog Heidenheim nach ST31: 22 Pkt./GD−31 hinter Rivalen mit 25 Pkt./besserer TD.
   * Mit 1:0 bliebe man Letzter der Dreiergruppe; mit Fokus-Margin + Rivalen-Niederlage
   * ist Bestfall mindestens ein Platz besser.
   */
  it('Bestfall überholt Punkterivalen per Fokus-TD (Heidenheim-Fall)', () => {
    const HDH: TeamInfo = {
      teamId: 199,
      teamName: 'Heidenheim',
      shortName: 'Heidenheim',
      teamIconUrl: '',
    }
    const WOB: TeamInfo = {
      teamId: 163,
      teamName: 'Wolfsburg',
      shortName: 'Wolfsburg',
      teamIconUrl: '',
    }
    const BAY: TeamInfo = {
      teamId: 40,
      teamName: 'Bayern',
      shortName: 'Bayern',
      teamIconUrl: '',
    }
    const FRE: TeamInfo = {
      teamId: 7,
      teamName: 'Freiburg',
      shortName: 'Freiburg',
      teamIconUrl: '',
    }

    const ranked: StandingRow[] = [
      {
        teamId: BAY.teamId,
        teamName: BAY.teamName,
        shortName: BAY.shortName,
        teamIconUrl: '',
        played: 31,
        won: 20,
        draw: 5,
        lost: 6,
        goalsFor: 70,
        goalsAgainst: 30,
        goalDiff: 40,
        points: 65,
        rank: 1,
      },
      {
        teamId: WOB.teamId,
        teamName: WOB.teamName,
        shortName: WOB.shortName,
        teamIconUrl: '',
        played: 31,
        won: 6,
        draw: 7,
        lost: 18,
        goalsFor: 41,
        goalsAgainst: 66,
        goalDiff: -25,
        points: 25,
        rank: 2,
      },
      {
        teamId: HDH.teamId,
        teamName: HDH.teamName,
        shortName: HDH.shortName,
        teamIconUrl: '',
        played: 31,
        won: 5,
        draw: 7,
        lost: 19,
        goalsFor: 35,
        goalsAgainst: 66,
        goalDiff: -31,
        points: 22,
        rank: 3,
      },
      {
        teamId: FRE.teamId,
        teamName: FRE.teamName,
        shortName: FRE.shortName,
        teamIconUrl: '',
        played: 31,
        won: 3,
        draw: 4,
        lost: 24,
        goalsFor: 20,
        goalsAgainst: 60,
        goalDiff: -40,
        points: 13,
        rank: 4,
      },
    ]

    const bayernVsHdh: Match = {
      matchID: 3201,
      matchDateTime: '2026-05-01T15:30:00',
      matchDateTimeUTC: '2026-05-01T13:30:00Z',
      leagueName: 'Bundesliga',
      leagueSeason: 2025,
      leagueShortcut: 'bl1',
      lastUpdateDateTime: '2026-05-01T17:00:00',
      matchIsFinished: false,
      matchResults: [],
      group: {
        groupName: '32. Spieltag',
        groupOrderID: 32,
        groupID: 1032,
      },
      team1: BAY,
      team2: HDH,
    }
    const freiburgVsWob: Match = {
      matchID: 3202,
      matchDateTime: '2026-05-01T15:30:00',
      matchDateTimeUTC: '2026-05-01T13:30:00Z',
      leagueName: 'Bundesliga',
      leagueSeason: 2025,
      leagueShortcut: 'bl1',
      lastUpdateDateTime: '2026-05-01T17:00:00',
      matchIsFinished: false,
      matchResults: [],
      group: {
        groupName: '32. Spieltag',
        groupOrderID: 32,
        groupID: 1032,
      },
      team1: FRE,
      team2: WOB,
    }

    expect(ranked.find((t) => t.teamId === HDH.teamId)!.rank).toBe(3)

    const outlook = computeNextMatchdayOutlook(
      ranked,
      [bayernVsHdh, freiburgVsWob],
      HDH.teamId,
    )!

    expect(outlook.plays).toBe(true)
    // Mit großzügiger TD: HDH 25 Pkt. + bessere GD als WOB nach deren Niederlage → Platz 2
    expect(outlook.range.bestRank).toBeLessThanOrEqual(2)
    expect(outlook.bestConditions?.ownMatch?.focusResult).toBe('win')
    expect(outlook.bestConditions?.ownMatch?.minGoalDiff).toBeGreaterThanOrEqual(6)
  })
})

describe('CaseConditions (nächster Spieltag)', () => {
  const OUTCOMES: MatchOutcome[] = ['home', 'draw', 'away']

  function rankAfterScenarios(
    matches: Match[],
    teamId: number,
    scenarios: ReturnType<typeof scenarioFromOutcome>[],
  ) {
    const table = buildStandings(matches, { scenarios })
    return table.find((t) => t.teamId === teamId)!.rank
  }

  type OpenSlot = { matchId: number; outcomes: MatchOutcome[] }

  function openSlotsFromConditions(
    cond: NonNullable<
      NonNullable<ReturnType<typeof computeNextMatchdayOutlook>>['bestConditions']
    >,
  ): OpenSlot[] {
    return [
      ...cond.partiallyConstrained.map((p) => ({
        matchId: p.matchId,
        outcomes: p.allowedOutcomes,
      })),
      ...cond.flexible.map((f) => ({
        matchId: f.matchId,
        outcomes: [...OUTCOMES],
      })),
    ]
  }

  /** Alle Belegungen der offenen Slots (kartesisches Produkt der outcome-Listen). */
  function* enumerateOpenAssignments(
    slots: OpenSlot[],
  ): Generator<ReturnType<typeof scenarioFromOutcome>[]> {
    if (slots.length === 0) {
      yield []
      return
    }
    const totals = slots.map((s) => s.outcomes.length)
    const total = totals.reduce((a, b) => a * b, 1)
    for (let mask = 0; mask < total; mask++) {
      let x = mask
      const scenarios: ReturnType<typeof scenarioFromOutcome>[] = []
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]!
        const n = totals[i]!
        const oi = x % n
        x = Math.floor(x / n)
        scenarios.push(scenarioFromOutcome(slot.matchId, slot.outcomes[oi]!))
      }
      yield scenarios
    }
  }

  function withOutcome(
    fixed: ReturnType<typeof scenarioFromOutcome>[],
    matchId: number,
    outcome: MatchOutcome,
  ) {
    return [
      ...fixed.filter((s) => s.matchId !== matchId),
      scenarioFromOutcome(matchId, outcome),
    ]
  }

  /**
   * K4 — vier getrennte Checks, keine universelle Kombinierbarkeit der offenen Spiele.
   * (Korrelierte Fremdspiele: jedes einzeln ok, aber nicht jede Kombination.)
   */
  function assertConditionsConsistent(opts: {
    matches: Match[]
    teamId: number
    claimedRank: number
    conditions: NonNullable<
      NonNullable<ReturnType<typeof computeNextMatchdayOutlook>>['bestConditions']
    >
  }) {
    const cond = opts.conditions
    expect(cond.mode).toBe('exact')

    const fixed = scenariosFromConditions(cond)
    const slots = openSlotsFromConditions(cond)

    // 1. Existenz: mind. eine Belegung der offenen Spiele trifft claimedRank
    let exists = false
    for (const open of enumerateOpenAssignments(slots)) {
      if (
        rankAfterScenarios(opts.matches, opts.teamId, [...fixed, ...open]) ===
        opts.claimedRank
      ) {
        exists = true
        break
      }
    }
    expect(exists).toBe(true)

    // 2. required-Korrektheit: anderer Ausgang → claimedRank nirgends erreichbar
    for (const req of cond.required) {
      for (const alt of OUTCOMES) {
        if (alt === req.outcome) continue
        const fixedAlt = withOutcome(fixed, req.matchId, alt)
        let hit = false
        for (const open of enumerateOpenAssignments(slots)) {
          if (
            rankAfterScenarios(opts.matches, opts.teamId, [
              ...fixedAlt,
              ...open,
            ]) === opts.claimedRank
          ) {
            hit = true
            break
          }
        }
        expect(hit).toBe(false)
      }
    }

    // 3. forbidden-Korrektheit (partiallyConstrained)
    for (const partial of cond.partiallyConstrained) {
      expect(partial.allowedOutcomes).toHaveLength(2)
      expect(partial.allowedOutcomes).not.toContain(partial.forbiddenOutcome)
      const otherSlots = slots.filter((s) => s.matchId !== partial.matchId)
      const pinned = scenarioFromOutcome(partial.matchId, partial.forbiddenOutcome)
      let hit = false
      for (const open of enumerateOpenAssignments(otherSlots)) {
        if (
          rankAfterScenarios(opts.matches, opts.teamId, [
            ...fixed,
            pinned,
            ...open,
          ]) === opts.claimedRank
        ) {
          hit = true
          break
        }
      }
      expect(hit).toBe(false)
    }

    // 4. Marginal: jeder erlaubte Einzelausgang ist mit IRGENDEINER Restbelegung ok
    for (const slot of slots) {
      const otherSlots = slots.filter((s) => s.matchId !== slot.matchId)
      for (const outcome of slot.outcomes) {
        const pinned = scenarioFromOutcome(slot.matchId, outcome)
        let hit = false
        for (const open of enumerateOpenAssignments(otherSlots)) {
          if (
            rankAfterScenarios(opts.matches, opts.teamId, [
              ...fixed,
              pinned,
              ...open,
            ]) === opts.claimedRank
          ) {
            hit = true
            break
          }
        }
        expect(hit).toBe(true)
      }
    }
  }

  /** Alte ∀-Invariante (vor K4) — nur Kontrast im Korrelations-Test. */
  function universalOpenCombosAllHitClaimedRank(opts: {
    matches: Match[]
    teamId: number
    claimedRank: number
    conditions: NonNullable<
      NonNullable<ReturnType<typeof computeNextMatchdayOutlook>>['bestConditions']
    >
  }): boolean {
    const fixed = scenariosFromConditions(opts.conditions)
    const slots = openSlotsFromConditions(opts.conditions)
    for (const open of enumerateOpenAssignments(slots)) {
      if (
        rankAfterScenarios(opts.matches, opts.teamId, [...fixed, ...open]) !==
        opts.claimedRank
      ) {
        return false
      }
    }
    return true
  }

  it('K3: |S|==2 setzt forbiddenOutcome (fehlendes 1/X/2)', () => {
    const fixtures = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    // own=home (0); Fremdspiel nur home/draw → Masken 0 und 3
    const cond = deriveExactCaseConditions(
      fixtures,
      TEAM_ALPHA.teamId,
      [0, 3],
      'best',
    )
    expect(cond.required).toEqual([])
    expect(cond.flexible).toEqual([])
    expect(cond.partiallyConstrained).toEqual([
      expect.objectContaining({
        matchId: MATCH_MD2_BETA_DELTA.matchID,
        allowedOutcomes: ['home', 'draw'],
        forbiddenOutcome: 'away',
      }),
    ])
  })

  it('K3: |S|==1 required, |S|==3 flexible', () => {
    const fixtures = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const requiredOnly = deriveExactCaseConditions(
      fixtures,
      TEAM_ALPHA.teamId,
      [0], // own home, foreign home
      'best',
    )
    expect(requiredOnly.required).toEqual([
      expect.objectContaining({
        matchId: MATCH_MD2_BETA_DELTA.matchID,
        outcome: 'home',
      }),
    ])
    expect(requiredOnly.partiallyConstrained).toEqual([])
    expect(requiredOnly.flexible).toEqual([])

    const allFlexible = deriveExactCaseConditions(
      fixtures,
      TEAM_ALPHA.teamId,
      [0, 3, 6], // own home; foreign home/draw/away
      'best',
    )
    expect(allFlexible.required).toEqual([])
    expect(allFlexible.partiallyConstrained).toEqual([])
    expect(allFlexible.flexible).toEqual([
      expect.objectContaining({ matchId: MATCH_MD2_BETA_DELTA.matchID }),
    ])
  })

  it('Bestfall Alpha: nur eigene Vorgabe nötig, Fremdspiel flexibel', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const outlook = computeNextMatchdayOutlook(base, remaining, TEAM_ALPHA.teamId)!

    expect(outlook.bestConditions).not.toBeNull()
    expect(outlook.bestConditions!.ownMatch).toMatchObject({
      matchId: MATCH_MD2_ALPHA_GAMMA.matchID,
      focusResult: 'win',
      outcome: 'home',
    })
    expect(outlook.bestConditions!.ownMatch?.minGoalDiff).toBeGreaterThanOrEqual(1)
    expect(outlook.bestConditions!.required).toEqual([])
    expect(outlook.bestConditions!.flexible).toEqual([
      expect.objectContaining({ matchId: MATCH_MD2_BETA_DELTA.matchID }),
    ])

    assertConditionsConsistent({
      matches: MINI_LEAGUE_MATCHES,
      teamId: TEAM_ALPHA.teamId,
      claimedRank: outlook.range.bestRank,
      conditions: outlook.bestConditions!,
    })
  })

  it('Schlechtfall Alpha: eigenes Ergebnis + notwendiges Fremdergebnis', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const outlook = computeNextMatchdayOutlook(base, remaining, TEAM_ALPHA.teamId)!

    expect(outlook.worstConditions).not.toBeNull()
    expect(outlook.worstConditions!.ownMatch?.focusResult).toBe('loss')
    expect(outlook.worstConditions!.required.length).toBeGreaterThanOrEqual(1)
    expect(outlook.worstConditions!.required[0]).toMatchObject({
      matchId: MATCH_MD2_BETA_DELTA.matchID,
      outcome: 'away',
    })

    assertConditionsConsistent({
      matches: MINI_LEAGUE_MATCHES,
      teamId: TEAM_ALPHA.teamId,
      claimedRank: outlook.range.worstRank,
      conditions: outlook.worstConditions!,
    })
  })

  it('konstruiert Fall mit mind. einem notwendigen und einem egalen Fremdspiel', () => {
    const FOCUS: TeamInfo = {
      teamId: 11,
      teamName: 'Focus',
      shortName: 'Focus',
      teamIconUrl: '',
    }
    const OPP: TeamInfo = {
      teamId: 12,
      teamName: 'Opp',
      shortName: 'Opp',
      teamIconUrl: '',
    }
    const RIVAL: TeamInfo = {
      teamId: 13,
      teamName: 'Rival',
      shortName: 'Rival',
      teamIconUrl: '',
    }
    const WEAK: TeamInfo = {
      teamId: 14,
      teamName: 'Weak',
      shortName: 'Weak',
      teamIconUrl: '',
    }
    const FARA: TeamInfo = {
      teamId: 15,
      teamName: 'FarA',
      shortName: 'FarA',
      teamIconUrl: '',
    }
    const FARB: TeamInfo = {
      teamId: 16,
      teamName: 'FarB',
      shortName: 'FarB',
      teamIconUrl: '',
    }

    function stubMatch(
      id: number,
      home: TeamInfo,
      away: TeamInfo,
      finished: boolean,
      score?: [number, number],
    ): Match {
      return {
        matchID: id,
        matchDateTime: '2025-08-01T15:30:00',
        matchDateTimeUTC: '2025-08-01T13:30:00Z',
        leagueName: 'Cond-Test',
        leagueSeason: 2025,
        leagueShortcut: 'ct',
        lastUpdateDateTime: '2025-08-01T17:00:00',
        group: {
          groupName: finished ? '1. Spieltag' : '2. Spieltag',
          groupOrderID: finished ? 1 : 2,
          groupID: finished ? 1 : 2,
        },
        team1: home,
        team2: away,
        matchIsFinished: finished,
        matchResults: score
          ? [
              {
                resultID: 1,
                resultName: 'Endergebnis',
                pointsTeam1: score[0],
                pointsTeam2: score[1],
                resultOrderID: 2,
                resultTypeID: 2,
              },
            ]
          : [],
      }
    }

    // Focus 4 Pkt, Rival 6 Pkt (hohe TD). FarA/FarB bei 0 — ihr Spiel egal für Platz 1.
    // Rival spielt gegen Opp: nur Opp-Sieg hält Focus auf Platz 1 (bei Focus-Sieg).
    const md1Clean = [
      stubMatch(101, FOCUS, WEAK, true, [2, 0]), // Focus 3, Weak 0
      stubMatch(102, OPP, FOCUS, true, [0, 0]), // Focus 4, Opp 1
      stubMatch(103, RIVAL, WEAK, true, [3, 0]), // Rival 3
      stubMatch(104, FARA, RIVAL, true, [0, 3]), // Rival 6, FarA 0
      stubMatch(105, FARB, OPP, true, [0, 1]), // FarB 0, Opp 4
      stubMatch(106, WEAK, FARB, true, [1, 0]), // Weak 3, FarB 0
    ]

    const open = [
      stubMatch(201, FOCUS, WEAK, false), // eigenes Spiel
      stubMatch(202, RIVAL, OPP, false), // notwendig: Opp schlägt Rival
      stubMatch(203, FARA, FARB, false), // egal
    ]

    const all = [...md1Clean, ...open]
    const base = buildStandings(all, { maxMatchday: 1 })
    expect(base.find((t) => t.teamId === FOCUS.teamId)!.points).toBe(4)
    expect(base.find((t) => t.teamId === RIVAL.teamId)!.points).toBe(6)
    expect(base.find((t) => t.teamId === FARA.teamId)!.points).toBe(0)
    expect(base.find((t) => t.teamId === FARB.teamId)!.points).toBe(0)

    const outlook = computeNextMatchdayOutlook(base, open, FOCUS.teamId)!
    expect(outlook.range.bestRank).toBe(1)

    const best = outlook.bestConditions!
    expect(best.ownMatch?.focusResult).toBe('win')
    expect(best.required).toEqual([
      expect.objectContaining({
        matchId: 202,
        outcome: 'away', // Opp schlägt Rival
      }),
    ])
    expect(best.flexible).toEqual([expect.objectContaining({ matchId: 203 })])

    assertConditionsConsistent({
      matches: all,
      teamId: FOCUS.teamId,
      claimedRank: outlook.range.bestRank,
      conditions: best,
    })
  })

  it('korrelierte Fremdspiele: K4 grün, alte ∀-Invariante rot', () => {
    /**
     * Focus spielfrei auf 10 Pkt.; RivalA/RivalB auf 9.
     * Genau einer der Rivalen siegt → Focus Platz 2.
     * Beide siegen → Platz 3; keiner → Platz 1.
     * Beide Fremdspiele sind einzeln in Platz-2-Masken mit allen 3 Ausgängen vertreten
     * (flexibel), aber RivalA-Sieg ∧ RivalB-Sieg ist nicht optimal für Platz 2.
     *
     * Die alte universelle Invariante (∀ Kombis der offenen Spiele: rank===claimed)
     * wäre hier rot; K4 (Checks 1–4) bleibt grün.
     */
    const FOCUS: TeamInfo = {
      teamId: 21,
      teamName: 'Focus',
      shortName: 'Focus',
      teamIconUrl: '',
    }
    const RIVALA: TeamInfo = {
      teamId: 22,
      teamName: 'RivalA',
      shortName: 'RivalA',
      teamIconUrl: '',
    }
    const RIVALB: TeamInfo = {
      teamId: 23,
      teamName: 'RivalB',
      shortName: 'RivalB',
      teamIconUrl: '',
    }
    const WEAKA: TeamInfo = {
      teamId: 24,
      teamName: 'WeakA',
      shortName: 'WeakA',
      teamIconUrl: '',
    }
    const WEAKB: TeamInfo = {
      teamId: 25,
      teamName: 'WeakB',
      shortName: 'WeakB',
      teamIconUrl: '',
    }
    const PAD: TeamInfo = {
      teamId: 26,
      teamName: 'Pad',
      shortName: 'Pad',
      teamIconUrl: '',
    }

    function stubMatch(
      id: number,
      home: TeamInfo,
      away: TeamInfo,
      finished: boolean,
      score?: [number, number],
    ): Match {
      return {
        matchID: id,
        matchDateTime: '2025-08-01T15:30:00',
        matchDateTimeUTC: '2025-08-01T13:30:00Z',
        leagueName: 'Corr-Test',
        leagueSeason: 2025,
        leagueShortcut: 'corr',
        lastUpdateDateTime: '2025-08-01T17:00:00',
        group: {
          groupName: finished ? '1. Spieltag' : '2. Spieltag',
          groupOrderID: finished ? 1 : 2,
          groupID: finished ? 1 : 2,
        },
        team1: home,
        team2: away,
        matchIsFinished: finished,
        matchResults: score
          ? [
              {
                resultID: 1,
                resultName: 'Endergebnis',
                pointsTeam1: score[0],
                pointsTeam2: score[1],
                resultOrderID: 2,
                resultTypeID: 2,
              },
            ]
          : [],
      }
    }

    // Focus 10 Pkt, RivalA/B 9 — Focus spielt nicht am ST2.
    const md1 = [
      stubMatch(301, FOCUS, WEAKA, true, [1, 0]), // Focus 3
      stubMatch(302, FOCUS, WEAKB, true, [1, 0]), // Focus 6
      stubMatch(303, FOCUS, PAD, true, [1, 1]), // Focus 7
      stubMatch(304, RIVALA, FOCUS, true, [0, 1]), // Focus 10, RivalA 0
      stubMatch(305, RIVALA, WEAKA, true, [1, 0]), // RivalA 3
      stubMatch(306, RIVALA, WEAKB, true, [1, 0]), // RivalA 6
      stubMatch(307, RIVALA, PAD, true, [1, 0]), // RivalA 9
      stubMatch(308, RIVALB, WEAKA, true, [1, 0]), // RivalB 3
      stubMatch(309, RIVALB, WEAKB, true, [1, 0]), // RivalB 6
      stubMatch(310, RIVALB, PAD, true, [1, 0]), // RivalB 9
      stubMatch(311, WEAKA, PAD, true, [1, 0]),
      stubMatch(312, WEAKB, PAD, true, [0, 0]),
    ]

    const open = [
      stubMatch(401, RIVALA, WEAKA, false),
      stubMatch(402, RIVALB, WEAKB, false),
    ]

    const all = [...md1, ...open]
    const base = buildStandings(all, { maxMatchday: 1 })
    expect(base.find((t) => t.teamId === FOCUS.teamId)!.points).toBe(10)
    expect(base.find((t) => t.teamId === RIVALA.teamId)!.points).toBe(9)
    expect(base.find((t) => t.teamId === RIVALB.teamId)!.points).toBe(9)

    const outlook = computeTargetMatchdayOutlook(
      base,
      open,
      FOCUS.teamId,
      2,
      'exact',
    )!
    expect(outlook.reachable).toBe(true)
    expect(outlook.conditions).toBeTruthy()

    const cond = outlook.conditions!
    // Beide Rivalen-Spiele offen/flexibel (kein required) — Korrelation nur joint
    expect(cond.required).toEqual([])
    expect(cond.flexible.map((f) => f.matchId).sort()).toEqual([401, 402])

    assertConditionsConsistent({
      matches: all,
      teamId: FOCUS.teamId,
      claimedRank: 2,
      conditions: cond,
    })

    // Kontrast: ∀ offenen Kombis rank===2 gilt hier nicht (beide-Sieg → Platz 3)
    expect(
      universalOpenCombosAllHitClaimedRank({
        matches: all,
        teamId: FOCUS.teamId,
        claimedRank: 2,
        conditions: cond,
      }),
    ).toBe(false)
  })
})

describe('computeSeasonOutlook', () => {
  it('garantiert bestRank <= worstRank', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const outlook = computeSeasonOutlook(base, remaining, TEAM_ALPHA.teamId)

    expect(outlook).not.toBeNull()
    expect(outlook!.range.bestRank).toBeLessThanOrEqual(outlook!.range.worstRank)
  })

  it('ohne Restspiele: best = worst = aktueller Rang', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const alphaRank = base.find((t) => t.teamId === TEAM_ALPHA.teamId)!.rank
    const outlook = computeSeasonOutlook(base, [], TEAM_ALPHA.teamId)

    expect(outlook!.range).toEqual({
      teamId: TEAM_ALPHA.teamId,
      bestRank: alphaRank,
      worstRank: alphaRank,
      mode: 'exact',
    })
    expect(outlook!.hardRange).toEqual({
      teamId: TEAM_ALPHA.teamId,
      hardBest: alphaRank,
      hardWorst: alphaRank,
    })
  })

  it('liefert keine Pathway-Bedingungen für die Saison', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const outlook = computeSeasonOutlook(base, remaining, TEAM_ALPHA.teamId)!

    expect(outlook.bestConditions).toBeNull()
    expect(outlook.worstConditions).toBeNull()
    expect(outlook.range.bestRank).toBeLessThanOrEqual(outlook.range.worstRank)
    expect(outlook.hardRange.hardBest).toBeLessThanOrEqual(outlook.range.bestRank)
    expect(outlook.hardRange.hardWorst).toBeGreaterThanOrEqual(
      outlook.range.worstRank,
    )
  })
})

describe('computeHardBounds / harte Spanne', () => {
  function team(id: number, name: string): TeamInfo {
    return {
      teamId: id,
      teamName: name,
      shortName: name.slice(0, 3),
      teamIconUrl: '',
    }
  }

  function standingRow(
    partial: Pick<
      StandingRow,
      'teamId' | 'teamName' | 'points' | 'goalDiff' | 'goalsFor' | 'rank'
    > &
      Partial<StandingRow>,
  ): StandingRow {
    const goalsAgainst =
      partial.goalsAgainst ??
      Math.max(0, (partial.goalsFor ?? 0) - (partial.goalDiff ?? 0))
    return {
      shortName: partial.teamName.slice(0, 3),
      teamIconUrl: '',
      played: 33,
      won: 0,
      draw: 0,
      lost: 0,
      goalsAgainst,
      ...partial,
    }
  }

  function openMatch(
    matchID: number,
    home: TeamInfo,
    away: TeamInfo,
    day = 34,
  ): Match {
    return {
      matchID,
      matchDateTime: '2025-05-17T15:30:00',
      matchDateTimeUTC: '2025-05-17T13:30:00Z',
      leagueName: 'Test-Liga',
      leagueSeason: 2025,
      leagueShortcut: 'test',
      lastUpdateDateTime: '2025-05-17T12:00:00',
      group: {
        groupName: `${day}. Spieltag`,
        groupOrderID: day,
        groupID: 1000 + day,
      },
      team1: home,
      team2: away,
      matchIsFinished: false,
      matchResults: [],
    }
  }

  function cologneBremenFixture() {
    const standings: StandingRow[] = []
    for (let i = 1; i <= 18; i++) {
      if (i <= 13) {
        standings.push(
          standingRow({
            teamId: i,
            teamName: `Team ${i}`,
            points: 60 - i,
            goalDiff: 20 - i,
            goalsFor: 40 - i,
            rank: i,
          }),
        )
      } else if (i === 14) {
        standings.push(
          standingRow({
            teamId: 14,
            teamName: 'Köln',
            shortName: 'KOE',
            points: 32,
            goalDiff: 5,
            goalsFor: 40,
            rank: 14,
          }),
        )
      } else if (i === 15) {
        standings.push(
          standingRow({
            teamId: 15,
            teamName: 'Bremen',
            shortName: 'BRE',
            points: 32,
            goalDiff: 0,
            goalsFor: 35,
            rank: 15,
          }),
        )
      } else {
        standings.push(
          standingRow({
            teamId: i,
            teamName: `Team ${i}`,
            points: 20 - (i - 15),
            goalDiff: -10 - (i - 15),
            goalsFor: 20,
            rank: i,
          }),
        )
      }
    }
    return {
      standings,
      remaining: [openMatch(3401, team(14, 'Köln'), team(15, 'Bremen'))],
    }
  }

  it('Soundness: harte Spanne enthält Brute-Force-Extreme', () => {
    const { standings, remaining } = cologneBremenFixture()
    const hard = computeHardRanges(standings, remaining)
    const exact = computeExactPositionRanges(standings, remaining)!
    for (const e of exact) {
      const h = hard.find((x) => x.teamId === e.teamId)!
      expect(h.hardBest).toBeLessThanOrEqual(e.bestRank)
      expect(h.hardWorst).toBeGreaterThanOrEqual(e.worstRank)
    }
  })

  it('Köln/Bremen: beide 14.–15.', () => {
    const { standings, remaining } = cologneBremenFixture()
    const koe = computeHardBounds(standings, remaining, 14)!
    const bre = computeHardBounds(standings, remaining, 15)!
    expect(koe).toEqual({ teamId: 14, hardBest: 14, hardWorst: 15 })
    expect(bre).toEqual({ teamId: 15, hardBest: 14, hardWorst: 15 })
  })

  it('Frühe Saison: Spanne nahezu 1.–Ligagröße', () => {
    const standings: StandingRow[] = Array.from({ length: 18 }, (_, i) =>
      standingRow({
        teamId: i + 1,
        teamName: `T${i + 1}`,
        points: 0,
        goalDiff: 0,
        goalsFor: 0,
        played: 0,
        rank: i + 1,
      }),
    )
    const remaining: Match[] = []
    for (let i = 0; i < 9; i++) {
      remaining.push(
        openMatch(
          5000 + i,
          team(i * 2 + 1, `T${i * 2 + 1}`),
          team(i * 2 + 2, `T${i * 2 + 2}`),
          1,
        ),
      )
    }
    const hard = computeHardRanges(standings, remaining)
    for (const h of hard) {
      expect(h.hardBest).toBe(1)
      expect(h.hardWorst).toBe(18)
    }
  })

  it('computeHardBounds stimmt mit computeHardRanges überein', () => {
    const { standings, remaining } = cologneBremenFixture()
    const all = computeHardRanges(standings, remaining)
    for (const row of standings) {
      expect(computeHardBounds(standings, remaining, row.teamId)).toEqual(
        all.find((h) => h.teamId === row.teamId),
      )
    }
  })

  it('Spieltag-Outlook enthält hardRange als äußere Garantie', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const outlook = computeNextMatchdayOutlook(
      base,
      remaining,
      TEAM_ALPHA.teamId,
    )!
    expect(outlook.hardRange.hardBest).toBeLessThanOrEqual(outlook.range.bestRank)
    expect(outlook.hardRange.hardWorst).toBeGreaterThanOrEqual(
      outlook.range.worstRank,
    )
  })
})

describe('computeExactPositionRanges / Saisonende', () => {
  const GOAL_OUTCOMES: Array<[number, number]> = [
    [1, 0],
    [1, 1],
    [0, 1],
  ]

  function team(id: number, name: string): TeamInfo {
    return {
      teamId: id,
      teamName: name,
      shortName: name.slice(0, 3),
      teamIconUrl: '',
    }
  }

  function standingRow(
    partial: Pick<
      StandingRow,
      'teamId' | 'teamName' | 'points' | 'goalDiff' | 'goalsFor' | 'rank'
    > &
      Partial<StandingRow>,
  ): StandingRow {
    const goalsAgainst =
      partial.goalsAgainst ??
      Math.max(0, (partial.goalsFor ?? 0) - (partial.goalDiff ?? 0))
    return {
      shortName: partial.teamName.slice(0, 3),
      teamIconUrl: '',
      played: 33,
      won: 0,
      draw: 0,
      lost: 0,
      goalsAgainst,
      ...partial,
    }
  }

  function openMatch(
    matchID: number,
    home: TeamInfo,
    away: TeamInfo,
    day = 34,
  ): Match {
    return {
      matchID,
      matchDateTime: '2025-05-17T15:30:00',
      matchDateTimeUTC: '2025-05-17T13:30:00Z',
      leagueName: 'Test-Liga',
      leagueSeason: 2025,
      leagueShortcut: 'test',
      lastUpdateDateTime: '2025-05-17T12:00:00',
      group: {
        groupName: `${day}. Spieltag`,
        groupOrderID: day,
        groupID: 1000 + day,
      },
      team1: home,
      team2: away,
      matchIsFinished: false,
      matchResults: [],
    }
  }

  /** Unabhängige 3^n-Enumeration (Test-Orakel, nicht die Produktionsfunktion). */
  function bruteForceExactRanges(base: StandingRow[], remaining: Match[]) {
    const best = new Map<number, number>()
    const worst = new Map<number, number>()
    for (const row of base) {
      best.set(row.teamId, base.length)
      worst.set(row.teamId, 1)
    }
    const total = 3 ** remaining.length
    for (let mask = 0; mask < total; mask++) {
      const map = new Map(base.map((s) => [s.teamId, { ...s }]))
      const scores: Array<{
        matchId: number
        homeId: number
        awayId: number
        homeGoals: number
        awayGoals: number
      }> = []
      let x = mask
      for (const match of remaining) {
        const [hg, ag] = GOAL_OUTCOMES[x % 3]!
        x = Math.floor(x / 3)
        const home = map.get(match.team1.teamId)!
        const away = map.get(match.team2.teamId)!
        home.played += 1
        away.played += 1
        home.goalsFor += hg
        home.goalsAgainst += ag
        away.goalsFor += ag
        away.goalsAgainst += hg
        home.goalDiff = home.goalsFor - home.goalsAgainst
        away.goalDiff = away.goalsFor - away.goalsAgainst
        if (hg > ag) {
          home.won += 1
          home.points += 3
          away.lost += 1
        } else if (hg < ag) {
          away.won += 1
          away.points += 3
          home.lost += 1
        } else {
          home.draw += 1
          away.draw += 1
          home.points += 1
          away.points += 1
        }
        scores.push({
          matchId: match.matchID,
          homeId: match.team1.teamId,
          awayId: match.team2.teamId,
          homeGoals: hg,
          awayGoals: ag,
        })
      }
      const table = rankStandings(
        [...map.values()].map(({ rank: _r, ...rest }) => rest),
        { matchScores: scores },
      )
      for (const row of table) {
        if (row.rank < best.get(row.teamId)!) best.set(row.teamId, row.rank)
        if (row.rank > worst.get(row.teamId)!) worst.set(row.teamId, row.rank)
      }
    }
    return base.map((row) => ({
      teamId: row.teamId,
      bestRank: best.get(row.teamId)!,
      worstRank: worst.get(row.teamId)!,
      mode: 'exact' as const,
    }))
  }

  /**
   * Letzter Spieltag: Köln & Bremen punktgleich 32, Köln bessere Tordiff → 14./15.
   * Direktduell offen → Bremen kann 14 erreichen, Köln kann auf 15 fallen.
   */
  function cologneBremenFixture() {
    const standings: StandingRow[] = []
    for (let i = 1; i <= 18; i++) {
      if (i <= 13) {
        standings.push(
          standingRow({
            teamId: i,
            teamName: `Team ${i}`,
            points: 60 - i,
            goalDiff: 20 - i,
            goalsFor: 40 - i,
            rank: i,
          }),
        )
      } else if (i === 14) {
        standings.push(
          standingRow({
            teamId: 14,
            teamName: 'Köln',
            shortName: 'KOE',
            points: 32,
            goalDiff: 2,
            goalsFor: 40,
            goalsAgainst: 38,
            rank: 14,
          }),
        )
      } else if (i === 15) {
        standings.push(
          standingRow({
            teamId: 15,
            teamName: 'Bremen',
            shortName: 'BRE',
            points: 32,
            goalDiff: 1,
            goalsFor: 38,
            goalsAgainst: 37,
            rank: 15,
          }),
        )
      } else {
        standings.push(
          standingRow({
            teamId: i,
            teamName: `Team ${i}`,
            points: 20 - (i - 15),
            goalDiff: -10 - (i - 15),
            goalsFor: 20,
            rank: i,
          }),
        )
      }
    }
    const koe = team(14, 'Köln')
    const bre = team(15, 'Bremen')
    return {
      standings,
      remaining: [openMatch(3401, koe, bre)],
      koeId: 14,
      breId: 15,
    }
  }

  it('Köln/Bremen letzter Spieltag: Ranges enthalten 15 bzw. 14, niemand fälschlich fix', () => {
    const { standings, remaining, koeId, breId } = cologneBremenFixture()
    const ranges = computePositionRanges(standings, remaining)
    const koe = ranges.find((r) => r.teamId === koeId)!
    const bre = ranges.find((r) => r.teamId === breId)!

    expect(koe.worstRank).toBeGreaterThanOrEqual(15)
    expect(bre.bestRank).toBeLessThanOrEqual(14)
    expect(koe.bestRank).not.toBe(koe.worstRank)
    expect(bre.bestRank).not.toBe(bre.worstRank)
  })

  it('stimmt mit Brute-Force min/max je Team überein', () => {
    const { standings, remaining } = cologneBremenFixture()
    const exact = computeExactPositionRanges(standings, remaining)!
    const oracle = bruteForceExactRanges(standings, remaining)
    expect(exact).toEqual(oracle)

    for (const row of standings) {
      const outlook = computeSeasonOutlook(standings, remaining, row.teamId)!
      expect(outlook.range).toEqual(exact.find((r) => r.teamId === row.teamId))
    }
  })

  it('Gegenprobe: kann B den Rang r von A erreichen, kann A auf r+1 fallen', () => {
    const { standings, remaining } = cologneBremenFixture()
    const ranges = computePositionRanges(standings, remaining)
    for (const a of ranges) {
      for (const b of ranges) {
        if (a.teamId === b.teamId) continue
        const r = a.bestRank
        if (b.bestRank <= r && r <= b.worstRank) {
          expect(a.worstRank).toBeGreaterThanOrEqual(r + 1)
        }
      }
    }
  })

  it('Pruning: >EXACT_LIMIT Restspiele, aber wenige relevante → Exact-Pfad', () => {
    /**
     * Viele Restspiele zwischen Teams ohne Punkte-Überlappung (singuläre Komponenten).
     * Nur Köln/Bremen überlappen → genau ein relevantes Spiel.
     */
    const standings: StandingRow[] = []
    for (let i = 1; i <= 18; i++) {
      if (i <= 12) {
        standings.push(
          standingRow({
            teamId: i,
            teamName: `Top ${i}`,
            points: 100 + (12 - i) * 8,
            goalDiff: 30 - i,
            goalsFor: 50 - i,
            rank: i,
          }),
        )
      } else if (i === 13) {
        standings.push(
          standingRow({
            teamId: 13,
            teamName: 'Mid',
            points: 55,
            goalDiff: 5,
            goalsFor: 35,
            rank: 13,
          }),
        )
      } else if (i === 14) {
        standings.push(
          standingRow({
            teamId: 14,
            teamName: 'Köln',
            shortName: 'KOE',
            points: 32,
            goalDiff: 2,
            goalsFor: 40,
            goalsAgainst: 38,
            rank: 14,
          }),
        )
      } else if (i === 15) {
        standings.push(
          standingRow({
            teamId: 15,
            teamName: 'Bremen',
            shortName: 'BRE',
            points: 32,
            goalDiff: 1,
            goalsFor: 38,
            goalsAgainst: 37,
            rank: 15,
          }),
        )
      } else {
        // Weit auseinander, je ≤1 Restspiel → keine Low-Low-Überlappung
        const pts = i === 16 ? 0 : i === 17 ? 10 : 20
        standings.push(
          standingRow({
            teamId: i,
            teamName: `Low ${i}`,
            points: pts,
            goalDiff: -20,
            goalsFor: 10,
            rank: i,
          }),
        )
      }
    }

    // 13 Spiele zwischen nicht-überlappenden Paaren (werden weggeprunt)
    const remaining: Match[] = []
    for (let i = 1; i <= 6; i++) {
      remaining.push(
        openMatch(4000 + i, team(i, `Top ${i}`), team(i + 6, `Top ${i + 6}`)),
      )
    }
    remaining.push(openMatch(4007, team(1, 'Top 1'), team(13, 'Mid')))
    remaining.push(openMatch(4008, team(2, 'Top 2'), team(16, 'Low 16')))
    remaining.push(openMatch(4009, team(3, 'Top 3'), team(17, 'Low 17')))
    remaining.push(openMatch(4010, team(4, 'Top 4'), team(18, 'Low 18')))
    remaining.push(openMatch(4011, team(5, 'Top 5'), team(8, 'Top 8')))
    remaining.push(openMatch(4012, team(6, 'Top 6'), team(9, 'Top 9')))
    remaining.push(openMatch(4013, team(7, 'Top 7'), team(10, 'Top 10')))
    remaining.push(openMatch(3401, team(14, 'Köln'), team(15, 'Bremen')))

    expect(remaining.length).toBeGreaterThan(EXACT_LIMIT)

    const relevantTeams = selectRelevantTeamIds(standings, remaining)
    expect(relevantTeams.has(14)).toBe(true)
    expect(relevantTeams.has(15)).toBe(true)
    expect(relevantTeams.has(1)).toBe(false)

    const relevant = selectRelevantMatches(standings, remaining)
    expect(relevant.map((m) => m.matchID)).toEqual([3401])
    expect(relevant.length).toBeLessThanOrEqual(EXACT_LIMIT)

    const exact = computeExactPositionRanges(standings, remaining)
    expect(exact).not.toBeNull()
    const koe = exact!.find((r) => r.teamId === 14)!
    const bre = exact!.find((r) => r.teamId === 15)!
    expect(koe.worstRank).toBeGreaterThanOrEqual(15)
    expect(bre.bestRank).toBeLessThanOrEqual(14)
    expect(koe.bestRank).not.toBe(koe.worstRank)

    const top = exact!.find((r) => r.teamId === 1)!
    expect(top.bestRank).toBe(top.worstRank)
  })
})

describe('Möglich: Exact vs. harte Spanne', () => {
  function team(id: number, name: string): TeamInfo {
    return {
      teamId: id,
      teamName: name,
      shortName: name.slice(0, 3),
      teamIconUrl: '',
    }
  }

  function standingRow(
    partial: Pick<
      StandingRow,
      'teamId' | 'teamName' | 'points' | 'goalDiff' | 'goalsFor' | 'rank'
    > &
      Partial<StandingRow>,
  ): StandingRow {
    const goalsAgainst =
      partial.goalsAgainst ??
      Math.max(0, (partial.goalsFor ?? 0) - (partial.goalDiff ?? 0))
    return {
      shortName: partial.teamName.slice(0, 3),
      teamIconUrl: '',
      played: 20,
      won: 0,
      draw: 0,
      lost: 0,
      goalsAgainst,
      ...partial,
    }
  }

  function openMatch(
    matchID: number,
    home: TeamInfo,
    away: TeamInfo,
    day = 21,
  ): Match {
    return {
      matchID,
      matchDateTime: '2025-01-15T15:30:00',
      matchDateTimeUTC: '2025-01-15T13:30:00Z',
      leagueName: 'Test-Liga',
      leagueSeason: 2025,
      leagueShortcut: 'test',
      lastUpdateDateTime: '2025-01-15T12:00:00',
      group: {
        groupName: `${day}. Spieltag`,
        groupOrderID: day,
        groupID: 1000 + day,
      },
      team1: home,
      team2: away,
      matchIsFinished: false,
      matchResults: [],
    }
  }

  /** Zwei getrennte Bänder: Top-Duell (Exact) + großes Abstiegsband (Hard). */
  function mixedModeFixture() {
    const standings: StandingRow[] = [
      standingRow({
        teamId: 1,
        teamName: 'Alpha',
        points: 60,
        goalDiff: 30,
        goalsFor: 50,
        rank: 1,
      }),
      standingRow({
        teamId: 2,
        teamName: 'Beta',
        points: 57,
        goalDiff: 20,
        goalsFor: 45,
        rank: 2,
      }),
    ]
    for (let i = 3; i <= 12; i++) {
      standings.push(
        standingRow({
          teamId: i,
          teamName: `Low ${i}`,
          points: 20 - Math.floor((i - 3) / 2),
          goalDiff: -5 - (i - 3),
          goalsFor: 18,
          rank: i,
        }),
      )
    }

    const remaining: Match[] = [
      openMatch(1, team(1, 'Alpha'), team(2, 'Beta'), 21),
    ]
    const lowIds = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    let mid = 100
    for (let a = 0; a < lowIds.length; a++) {
      for (let b = a + 1; b < lowIds.length; b++) {
        remaining.push(
          openMatch(
            mid++,
            team(lowIds[a]!, `Low ${lowIds[a]}`),
            team(lowIds[b]!, `Low ${lowIds[b]}`),
            21 + ((mid - 100) % 5),
          ),
        )
        // Top-Duell + >EXACT_LIMIT Abstiegs-Spiele
        if (remaining.length > EXACT_LIMIT + 1) break
      }
      if (remaining.length > EXACT_LIMIT + 1) break
    }
    return { standings, remaining }
  }

  it('Exact liegt immer innerhalb der harten Spanne (Endspiel-Fixture)', () => {
    const standings: StandingRow[] = []
    for (let i = 1; i <= 18; i++) {
      if (i <= 13) {
        standings.push(
          standingRow({
            teamId: i,
            teamName: `Team ${i}`,
            points: 60 - i,
            goalDiff: 20 - i,
            goalsFor: 40 - i,
            played: 33,
            rank: i,
          }),
        )
      } else if (i === 14) {
        standings.push(
          standingRow({
            teamId: 14,
            teamName: 'Köln',
            points: 32,
            goalDiff: 5,
            goalsFor: 40,
            played: 33,
            rank: 14,
          }),
        )
      } else if (i === 15) {
        standings.push(
          standingRow({
            teamId: 15,
            teamName: 'Bremen',
            points: 32,
            goalDiff: 0,
            goalsFor: 35,
            played: 33,
            rank: 15,
          }),
        )
      } else {
        standings.push(
          standingRow({
            teamId: i,
            teamName: `Team ${i}`,
            points: 20 - (i - 15),
            goalDiff: -10 - (i - 15),
            goalsFor: 20,
            played: 33,
            rank: i,
          }),
        )
      }
    }
    const remaining = [openMatch(3401, team(14, 'Köln'), team(15, 'Bremen'), 34)]
    const ranges = computePositionRanges(standings, remaining)
    const hard = computeHardRanges(standings, remaining)

    for (const r of ranges) {
      expect(r.mode).toBe('exact')
      const h = hard.find((x) => x.teamId === r.teamId)!
      expect(r.bestRank).toBeGreaterThanOrEqual(h.hardBest)
      expect(r.worstRank).toBeLessThanOrEqual(h.hardWorst)
    }

    const koe = ranges.find((r) => r.teamId === 14)!
    expect(koe.bestRank).not.toBe(koe.worstRank)
  })

  it('am Saisonende: Exact-Modus, engere oder gleiche Spanne innerhalb hart', () => {
    const standings: StandingRow[] = Array.from({ length: 4 }, (_, i) =>
      standingRow({
        teamId: i + 1,
        teamName: `T${i + 1}`,
        points: 10 - i,
        goalDiff: 5 - i,
        goalsFor: 10,
        played: 5,
        rank: i + 1,
      }),
    )
    const remaining = [
      openMatch(1, team(1, 'T1'), team(2, 'T2')),
      openMatch(2, team(3, 'T3'), team(4, 'T4')),
    ]
    const ranges = computePositionRanges(standings, remaining)
    const hard = computeHardRanges(standings, remaining)
    expect(ranges.every((r) => r.mode === 'exact')).toBe(true)
    for (const r of ranges) {
      const h = hard.find((x) => x.teamId === r.teamId)!
      expect(r.bestRank).toBeGreaterThanOrEqual(h.hardBest)
      expect(r.worstRank).toBeLessThanOrEqual(h.hardWorst)
      const outlook = computeSeasonOutlook(standings, remaining, r.teamId)!
      expect(outlook.range.mode).toBe('exact')
      expect(outlook.hardRange.hardBest).toBeLessThanOrEqual(
        outlook.range.bestRank,
      )
      expect(outlook.hardRange.hardWorst).toBeGreaterThanOrEqual(
        outlook.range.worstRank,
      )
    }
  })

  it('zwei Vereine am selben Stand: einer Exact, einer Hard', () => {
    const { standings, remaining } = mixedModeFixture()
    const topRelevant = relevantMatchesForTeam(standings, remaining, 1)
    const lowRelevant = relevantMatchesForTeam(standings, remaining, 3)
    expect(topRelevant.length).toBeLessThanOrEqual(EXACT_LIMIT)
    expect(lowRelevant.length).toBeGreaterThan(EXACT_LIMIT)

    const ranges = computePositionRanges(standings, remaining)
    const alpha = ranges.find((r) => r.teamId === 1)!
    const low = ranges.find((r) => r.teamId === 3)!
    expect(alpha.mode).toBe('exact')
    expect(low.mode).toBe('hard')

    const hardLow = computeHardBounds(standings, remaining, 3)!
    expect(low.bestRank).toBe(hardLow.hardBest)
    expect(low.worstRank).toBe(hardLow.hardWorst)

    const outlookLow = computeSeasonOutlook(standings, remaining, 3)!
    expect(outlookLow.range.mode).toBe('hard')
    expect(outlookLow.range.bestRank).toBe(hardLow.hardBest)
  })

  it('Hard-Modus: Spanne = harte Bounds, kein mind.-Heuristik-Pfad', () => {
    const { standings, remaining } = mixedModeFixture()
    const ranges = computePositionRanges(standings, remaining)
    const hard = computeHardRanges(standings, remaining)
    for (const r of ranges.filter((x) => x.mode === 'hard')) {
      const h = hard.find((x) => x.teamId === r.teamId)!
      expect(r.bestRank).toBe(h.hardBest)
      expect(r.worstRank).toBe(h.hardWorst)
    }
    expect(ranges.some((r) => r.mode === 'exact')).toBe(true)
    expect(ranges.some((r) => r.mode === 'hard')).toBe(true)
  })
})

describe('computeTargetMatchdayOutlook', () => {
  it('Zielplatz exakt erreichbar: Bedingungen konsistent', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const outlook = computeTargetMatchdayOutlook(
      base,
      remaining,
      TEAM_ALPHA.teamId,
      1,
      'exact',
    )!

    expect(outlook.reachable).toBe(true)
    expect(outlook.conditions).toBeTruthy()
    expect(outlook.conditions!.mode).toBe('exact')

    const OUTCOMES: MatchOutcome[] = ['home', 'draw', 'away']
    const cond = outlook.conditions!
    const fixed = scenariosFromConditions(cond)
    const flexTotal = 3 ** cond.flexible.length
    for (let mask = 0; mask < flexTotal; mask++) {
      let x = mask
      const scenarios = [...fixed]
      for (const f of cond.flexible) {
        scenarios.push(scenarioFromOutcome(f.matchId, OUTCOMES[x % 3]!))
        x = Math.floor(x / 3)
      }
      const table = buildStandings(MINI_LEAGUE_MATCHES, { scenarios })
      expect(table.find((t) => t.teamId === TEAM_ALPHA.teamId)!.rank).toBe(1)
    }
  })

  it('unerreichbarer Zielplatz: reachable false + nearestReachable', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const outlook = computeTargetMatchdayOutlook(
      base,
      [MATCH_MD2_BETA_DELTA],
      TEAM_ALPHA.teamId,
      4,
      'exact',
    )!
    expect(outlook.reachable).toBe(false)
    expect(outlook.nearestReachable).toBeTypeOf('number')
    expect(outlook.nearestReachable!).toBeGreaterThanOrEqual(1)
    expect(outlook.nearestReachable!).toBeLessThanOrEqual(4)
  })

  it('atLeast ist Obermenge von exact (Masken-Anzahl)', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const exact = computeTargetMatchdayOutlook(
      base,
      remaining,
      TEAM_ALPHA.teamId,
      2,
      'exact',
    )!
    const atLeast = computeTargetMatchdayOutlook(
      base,
      remaining,
      TEAM_ALPHA.teamId,
      2,
      'atLeast',
    )!
    expect(exact.reachable).toBe(true)
    expect(atLeast.reachable).toBe(true)
    expect(atLeast.conditions!.totalWays).toBeGreaterThanOrEqual(
      exact.conditions!.totalWays,
    )
  })

  it('ownOptions: Remis und Sieg reichen → Default Remis, Sieg als Alternative', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const outlook = computeTargetMatchdayOutlook(
      base,
      remaining,
      TEAM_ALPHA.teamId,
      1,
      'exact',
    )!
    expect(outlook.reachable).toBe(true)
    expect(outlook.conditions!.ownMatch?.focusResult).toBe('draw')
    expect(outlook.ownOptions?.some((o) => o.focusResult === 'win')).toBe(true)
    expect(outlook.ownOptions?.some((o) => o.focusResult === 'draw')).toBeFalsy()
  })
})

describe('simulateExtremeFinish Rivalen-TD', () => {
  it('Schlechtfall: Rivale überholt Fokus nur mit großer eigener Tordifferenz', () => {
    const FOCUS: TeamInfo = {
      teamId: 1,
      teamName: 'Focus',
      shortName: 'Focus',
      teamIconUrl: '',
    }
    const RIVAL: TeamInfo = {
      teamId: 2,
      teamName: 'Rival',
      shortName: 'Rival',
      teamIconUrl: '',
    }
    const WEAK: TeamInfo = {
      teamId: 3,
      teamName: 'Weak',
      shortName: 'Weak',
      teamIconUrl: '',
    }

    // Focus 36 / GD 0; Rival 33 / GD −2. Rival +3 Punkte → Gleichstand.
    // 1:0 → Rival GD −1, Focus bleibt vorn. Margin-Sieg → Rival GD besser → überholt.
    const standings: StandingRow[] = [
      {
        teamId: FOCUS.teamId,
        teamName: FOCUS.teamName,
        shortName: FOCUS.shortName,
        teamIconUrl: '',
        played: 30,
        won: 11,
        draw: 3,
        lost: 16,
        goalsFor: 40,
        goalsAgainst: 40,
        goalDiff: 0,
        points: 36,
        rank: 1,
      },
      {
        teamId: RIVAL.teamId,
        teamName: RIVAL.teamName,
        shortName: RIVAL.shortName,
        teamIconUrl: '',
        played: 30,
        won: 10,
        draw: 3,
        lost: 17,
        goalsFor: 30,
        goalsAgainst: 32,
        goalDiff: -2,
        points: 33,
        rank: 2,
      },
      {
        teamId: WEAK.teamId,
        teamName: WEAK.teamName,
        shortName: WEAK.shortName,
        teamIconUrl: '',
        played: 30,
        won: 2,
        draw: 2,
        lost: 26,
        goalsFor: 10,
        goalsAgainst: 80,
        goalDiff: -70,
        points: 8,
        rank: 3,
      },
    ]

    const rivalVsWeak: Match = {
      matchID: 9201,
      matchDateTime: '2026-05-01T15:30:00',
      matchDateTimeUTC: '2026-05-01T13:30:00Z',
      leagueName: 'Test',
      leagueSeason: 2025,
      leagueShortcut: 't',
      lastUpdateDateTime: '2026-05-01T17:00:00',
      matchIsFinished: false,
      matchResults: [],
      group: { groupName: '31. Spieltag', groupOrderID: 31, groupID: 31 },
      team1: RIVAL,
      team2: WEAK,
    }

    const worst = simulateExtremeFinishForTest(
      standings,
      [rivalVsWeak],
      FOCUS.teamId,
      'worst',
    )
    expect(worst.rank).toBe(2)

    // Alte ±1-Heuristik: Rival 1:0 → punktgleich, Focus behält bessere TD
    const drafts = standings.map((r) => ({
      teamId: r.teamId,
      teamName: r.teamName,
      shortName: r.shortName,
      teamIconUrl: '',
      played: r.played,
      won: r.won,
      draw: r.draw,
      lost: r.lost,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      goalDiff: r.goalDiff,
      points: r.points,
    }))
    const map = new Map(drafts.map((d) => [d.teamId, { ...d }]))
    applyScore(map, RIVAL.teamId, WEAK.teamId, 1, 0)
    const table = rankStandings([...map.values()], {
      matchScores: [
        {
          matchId: 9201,
          homeId: RIVAL.teamId,
          awayId: WEAK.teamId,
          homeGoals: 1,
          awayGoals: 0,
        },
      ],
    })
    const oldRank = table.find((t) => t.teamId === FOCUS.teamId)!.rank
    expect(oldRank).toBe(1)
    expect(worst.rank).toBeGreaterThan(oldRank)
  })
})
