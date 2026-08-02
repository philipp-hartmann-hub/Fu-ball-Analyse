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
  scenarioFromOutcome,
  scenarioFromScore,
} from './scenarios'
import { buildStandings } from './table'

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
    // Nur Beta–Delta am „nächsten“ Tag – Alpha spielt nicht
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
})
