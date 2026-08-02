import { describe, expect, it } from 'vitest'
import {
  EXPECTED_AFTER_MD1,
  MATCH_MD1_ALPHA_BETA,
  MATCH_NO_RESULTS,
  MATCH_ORDER_FALLBACK,
  MINI_LEAGUE_FINISHED,
  MINI_LEAGUE_MATCHES,
  MINI_LEAGUE_OPEN,
  TEAM_ALPHA,
} from './__fixtures__/miniLeague'
import {
  buildStandings,
  compareStandings,
  currentMatchday,
  finalResult,
  matchdays,
  remainingMatches,
  zoneForRank,
} from './table'
import type { StandingRow } from '../types'

function row(
  partial: Pick<StandingRow, 'teamId' | 'teamName' | 'points' | 'goalDiff' | 'goalsFor'> &
    Partial<StandingRow>,
): StandingRow {
  return {
    shortName: partial.teamName.slice(0, 3),
    teamIconUrl: '',
    played: 0,
    won: 0,
    draw: 0,
    lost: 0,
    goalsAgainst: 0,
    rank: 0,
    ...partial,
  }
}

describe('buildStandings', () => {
  it('berechnet Punkte, Tordifferenz und Rang aus fertigen Fixtures', () => {
    const table = buildStandings(MINI_LEAGUE_MATCHES)

    expect(table).toHaveLength(4)
    for (const expected of EXPECTED_AFTER_MD1) {
      const team = table.find((t) => t.teamId === expected.teamId)
      expect(team).toMatchObject(expected)
    }
  })

  it('respektiert maxMatchday und ignoriert spätere Spieltage', () => {
    const withCutoff = buildStandings(MINI_LEAGUE_MATCHES, { maxMatchday: 1 })
    expect(withCutoff.map((t) => t.teamId)).toEqual([1, 4, 3, 2])
    expect(withCutoff.every((t) => t.played === 1)).toBe(true)
  })

  it('wendet Szenarien auf offene Spiele an', () => {
    const table = buildStandings(MINI_LEAGUE_MATCHES, {
      scenarios: [{ matchId: 201, homeGoals: 1, awayGoals: 0 }],
    })
    const alpha = table.find((t) => t.teamId === TEAM_ALPHA.teamId)!
    expect(alpha.points).toBe(6)
    expect(alpha.played).toBe(2)
  })
})

describe('compareStandings', () => {
  it('sortiert nach Punkte > Tordiff > Tore > Name', () => {
    const a = row({
      teamId: 1,
      teamName: 'Alpha',
      points: 4,
      goalDiff: 1,
      goalsFor: 3,
    })
    const b = row({
      teamId: 2,
      teamName: 'Beta',
      points: 6,
      goalDiff: 0,
      goalsFor: 1,
    })
    expect(compareStandings(a, b)).toBeGreaterThan(0) // b vor a
    expect(compareStandings(b, a)).toBeLessThan(0)

    const samePtsBetterDiff = row({
      teamId: 3,
      teamName: 'Gamma',
      points: 4,
      goalDiff: 5,
      goalsFor: 1,
    })
    expect(compareStandings(a, samePtsBetterDiff)).toBeGreaterThan(0)

    const sameDiffMoreGoals = row({
      teamId: 4,
      teamName: 'Delta',
      points: 4,
      goalDiff: 1,
      goalsFor: 9,
    })
    expect(compareStandings(a, sameDiffMoreGoals)).toBeGreaterThan(0)

    const sameAllEarlierName = row({
      teamId: 5,
      teamName: 'Aardvark',
      points: 4,
      goalDiff: 1,
      goalsFor: 3,
    })
    expect(compareStandings(sameAllEarlierName, a)).toBeLessThan(0)
  })
})

describe('finalResult', () => {
  it('bevorzugt resultTypeID=2 gegenüber Halbzeit', () => {
    const result = finalResult(MATCH_MD1_ALPHA_BETA)
    expect(result).toMatchObject({
      resultTypeID: 2,
      pointsTeam1: 2,
      pointsTeam2: 1,
    })
  })

  it('nimmt sonst die höchste resultOrderID', () => {
    const result = finalResult(MATCH_ORDER_FALLBACK)
    expect(result).toMatchObject({
      resultOrderID: 5,
      pointsTeam1: 3,
      pointsTeam2: 2,
    })
  })

  it('liefert null ohne Ergebnisse', () => {
    expect(finalResult(MATCH_NO_RESULTS)).toBeNull()
  })
})

describe('remainingMatches / currentMatchday / matchdays', () => {
  it('matchdays liefert sortierte Spieltag-IDs', () => {
    expect(matchdays(MINI_LEAGUE_MATCHES)).toEqual([1, 2])
  })

  it('bei offenen Spielen: remaining = unfertig, current = frühester offener Tag', () => {
    expect(remainingMatches(MINI_LEAGUE_MATCHES).map((m) => m.matchID)).toEqual([
      201, 202,
    ])
    expect(currentMatchday(MINI_LEAGUE_MATCHES)).toBe(2)
  })

  it('mit Cutoff: remaining = Spiele nach maxMatchday', () => {
    expect(remainingMatches(MINI_LEAGUE_MATCHES, 1).map((m) => m.matchID)).toEqual([
      201, 202,
    ])
    expect(remainingMatches(MINI_LEAGUE_MATCHES, 2)).toEqual([])
  })

  it('Saison zu Ende: remaining leer, current = letzter Spieltag', () => {
    expect(remainingMatches(MINI_LEAGUE_FINISHED)).toEqual([])
    expect(currentMatchday(MINI_LEAGUE_FINISHED)).toBe(1)
  })

  it('alles offen: remaining = alle, current = erster Spieltag', () => {
    const allOpen = MINI_LEAGUE_MATCHES.map((m) => ({
      ...m,
      matchIsFinished: false,
      matchResults: [],
    }))
    expect(remainingMatches(allOpen)).toHaveLength(4)
    expect(currentMatchday(allOpen)).toBe(1)
    expect(MINI_LEAGUE_OPEN).toHaveLength(2)
  })
})

describe('zoneForRank', () => {
  it('BL1 an allen Zonengrenzen', () => {
    expect(zoneForRank(1, 'bl1')).toBe('champion')
    expect(zoneForRank(4, 'bl1')).toBe('cl')
    expect(zoneForRank(5, 'bl1')).toBe('el')
    expect(zoneForRank(6, 'bl1')).toBe('ecl')
    expect(zoneForRank(7, 'bl1')).toBe('mid')
    expect(zoneForRank(16, 'bl1')).toBe('relegation')
    expect(zoneForRank(17, 'bl1')).toBe('direct-relegation')
    expect(zoneForRank(18, 'bl1')).toBe('direct-relegation')
  })

  it('BL2 an allen Zonengrenzen', () => {
    expect(zoneForRank(1, 'bl2')).toBe('champion')
    expect(zoneForRank(2, 'bl2')).toBe('champion')
    expect(zoneForRank(3, 'bl2')).toBe('cl')
    expect(zoneForRank(4, 'bl2')).toBe('mid')
    expect(zoneForRank(16, 'bl2')).toBe('relegation')
    expect(zoneForRank(17, 'bl2')).toBe('direct-relegation')
  })
})
