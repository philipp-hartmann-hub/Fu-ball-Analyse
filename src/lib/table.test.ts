import { describe, expect, it } from 'vitest'
import {
  EXPECTED_AFTER_MD1,
  MATCH_MD1_ALPHA_BETA,
  MATCH_MD1_GAMMA_DELTA,
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
  rankStandings,
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
  it('sortiert nach Punkte > Tordiff > Tore (Name nur als Rest)', () => {
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

describe('rankStandings DFL / Direktvergleich', () => {
  const meta = {
    shortName: 'X',
    teamIconUrl: '',
    played: 2,
    won: 1,
    draw: 0,
    lost: 1,
    goalsAgainst: 1,
  }

  it('2er-H2H: Sieger des direkten Duells vor alphabetischem Fallback', () => {
    // Beide 3 Pkt, GD 0, GF 1 — ohne H2H käme Alpha vor Zulu
    const alpha = row({
      teamId: 1,
      teamName: 'Alpha',
      points: 3,
      goalDiff: 0,
      goalsFor: 1,
      ...meta,
    })
    const zulu = row({
      teamId: 2,
      teamName: 'Zulu',
      points: 3,
      goalDiff: 0,
      goalsFor: 1,
      ...meta,
    })
    const scores = [
      {
        matchId: 1,
        homeId: 1,
        awayId: 2,
        homeGoals: 0,
        awayGoals: 1, // Zulu gewinnt auswärts
      },
      {
        matchId: 2,
        homeId: 2,
        awayId: 1,
        homeGoals: 0,
        awayGoals: 0,
      },
    ]
    // H2H: Zulu 4 Pkt, Alpha 1 Pkt
    const ranked = rankStandings([alpha, zulu], { matchScores: scores })
    expect(ranked.map((r) => r.teamId)).toEqual([2, 1])
  })

  it('H2H dreht Reihenfolge gegenüber Gesamt-Auswärtstoren um', () => {
    // Gleiche Pkt/Diff/Tore. Alpha hat mehr Auswärtstore gesamt (aus einem
    // irrelevanten Spiel gegen Dritte), verliert aber den Direktvergleich.
    const alpha = row({
      teamId: 10,
      teamName: 'Alpha',
      points: 4,
      goalDiff: 1,
      goalsFor: 3,
      played: 3,
      won: 1,
      draw: 1,
      lost: 1,
      goalsAgainst: 2,
    })
    const beta = row({
      teamId: 11,
      teamName: 'Beta',
      points: 4,
      goalDiff: 1,
      goalsFor: 3,
      played: 3,
      won: 1,
      draw: 1,
      lost: 1,
      goalsAgainst: 2,
    })
    const scores = [
      // Direktvergleich: Beta gewinnt zu Hause 2:1
      { matchId: 1, homeId: 11, awayId: 10, homeGoals: 2, awayGoals: 1 },
      // Remis untereinander auswärts für Alpha (0:0)
      { matchId: 2, homeId: 10, awayId: 11, homeGoals: 0, awayGoals: 0 },
      // Alpha schießt 2 Auswärtstore gegen Team 99 (nicht in der Gleichstandsgruppe)
      { matchId: 3, homeId: 99, awayId: 10, homeGoals: 0, awayGoals: 2 },
      // Beta nur 0 Auswärtstore gegen 99
      { matchId: 4, homeId: 99, awayId: 11, homeGoals: 1, awayGoals: 0 },
    ]
    // Gesamt-Auswärtstore: Alpha 3, Beta 0 — ohne H2H würde Alpha vorne liegen.
    // H2H-Punkte: Beta 4, Alpha 1 → Beta vorne.
    const ranked = rankStandings([alpha, beta], { matchScores: scores })
    expect(ranked.map((r) => r.teamId)).toEqual([11, 10])
  })

  it('3er-Mini-Liga: H2H-Punkte entscheiden bei Punkt-/Diff-/Tor-Gleichheit', () => {
    const a = row({
      teamId: 1,
      teamName: 'A',
      points: 6,
      goalDiff: 0,
      goalsFor: 2,
      played: 4,
      won: 2,
      draw: 0,
      lost: 2,
      goalsAgainst: 2,
    })
    const b = row({
      teamId: 2,
      teamName: 'B',
      points: 6,
      goalDiff: 0,
      goalsFor: 2,
      played: 4,
      won: 2,
      draw: 0,
      lost: 2,
      goalsAgainst: 2,
    })
    const c = row({
      teamId: 3,
      teamName: 'C',
      points: 6,
      goalDiff: 0,
      goalsFor: 2,
      played: 4,
      won: 2,
      draw: 0,
      lost: 2,
      goalsAgainst: 2,
    })
    // Mini-Liga Hinspiele: A schlägt B, B schlägt C, C schlägt A — je 3 H2H-Pkt.
    // Rückspiele: A schlägt C, B schlägt A, C schlägt B — wieder je 3 → alle 6 H2H.
    // Zusätzlich: A gewinnt ein weiteres H2H? Keep balanced then use away goals.
    // Simpler: only one round — A>B, B>C, C>A each 3 pts. Then H2H away goals:
    // A scored away vs C? C home A away — A won away 1-0 → A has 1 H2H away goal
    // B scored away vs A — B won away → 1
    // C scored away vs B → 1
    // Still tied on H2H away — use overall away from scores.
    const scores = [
      { matchId: 1, homeId: 1, awayId: 2, homeGoals: 1, awayGoals: 0 }, // A home
      { matchId: 2, homeId: 2, awayId: 3, homeGoals: 1, awayGoals: 0 }, // B home
      { matchId: 3, homeId: 3, awayId: 1, homeGoals: 0, awayGoals: 1 }, // A wins away vs C
    ]
    // H2H points: A 6 (beat B home + C away), B 3, C 0
    const ranked = rankStandings([a, b, c], { matchScores: scores })
    expect(ranked.map((r) => r.teamId)).toEqual([1, 2, 3])
  })

  it('Szenario-Ergebnis zählt im Direktvergleich wie ein fertiges Spiel', () => {
    const openAlphaBeta = {
      ...MATCH_MD1_ALPHA_BETA,
      matchIsFinished: false,
      matchResults: [],
    }
    const table = buildStandings([openAlphaBeta, MATCH_MD1_GAMMA_DELTA], {
      scenarios: [{ matchId: 101, homeGoals: 0, awayGoals: 2 }],
    })
    const alpha = table.find((t) => t.teamId === 1)!
    const beta = table.find((t) => t.teamId === 2)!
    expect(beta.points).toBeGreaterThan(alpha.points)
    expect(beta.rank).toBeLessThan(alpha.rank)
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
