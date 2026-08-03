import { describe, expect, it } from 'vitest'
import {
  MATCH_MD2_ALPHA_GAMMA,
  MATCH_MD2_BETA_DELTA,
  MINI_LEAGUE_MATCHES,
  TEAM_ALPHA,
} from './__fixtures__/miniLeague'
import {
  computeNextMatchdayOutlook,
  computeSeasonOutlook,
  computeTargetMatchdayOutlook,
  scenarioFromOutcome,
  scenarioFromScore,
  scenariosFromConditions,
} from './scenarios'
import { buildStandings } from './table'
import type { Match, MatchOutcome, TeamInfo } from '../types'

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
   * Vier getrennte Checks — keine universelle Kombinierbarkeit der offenen Spiele.
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
      const allowed = new Set(partial.allowedOutcomes)
      const otherSlots = slots.filter((s) => s.matchId !== partial.matchId)
      for (const forbidden of OUTCOMES) {
        if (allowed.has(forbidden)) continue
        const pinned = scenarioFromOutcome(partial.matchId, forbidden)
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

  /** Alte universelle Invariante — nur zum Kontrast im Korrelations-Test. */
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

  it('korrelierte Fremdspiele: marginal ok, aber nicht jede Kombi (alte Invariante würde rot)', () => {
    /**
     * Focus spielfrei auf 10 Pkt.; RivalA/RivalB auf 9.
     * Genau einer der Rivalen siegt → Focus Platz 2.
     * Beide siegen → Platz 3; keiner → Platz 1.
     * Beide Fremdspiele sind einzeln in Platz-2-Masken mit allen 3 Ausgängen vertreten
     * (flexibel), aber RivalA-Sieg ∧ RivalB-Sieg ist nicht optimal für Platz 2.
     *
     * Die alte universelle Invariante (∀ Kombis der offenen Spiele: rank===claimed)
     * wäre hier rot; die neuen Checks 1–4 bleiben grün.
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
    })
  })

  it('liefert heuristische Bedingungen mit ownRest', () => {
    const base = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    const remaining = [MATCH_MD2_ALPHA_GAMMA, MATCH_MD2_BETA_DELTA]
    const outlook = computeSeasonOutlook(base, remaining, TEAM_ALPHA.teamId)!

    expect(outlook.bestConditions?.mode).toBe('heuristic')
    expect(outlook.bestConditions!.ownRest.length).toBe(1)
    expect(outlook.bestConditions!.ownRest[0]?.focusResult).toBe('win')
    expect(outlook.bestConditions!.required).toEqual([])
    expect(outlook.worstConditions!.ownRest[0]?.focusResult).toBe('loss')
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
