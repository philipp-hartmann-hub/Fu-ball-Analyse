import { describe, expect, it } from 'vitest'
import {
  TEAM_ALPHA,
  TEAM_BETA,
  TEAM_DELTA,
  TEAM_GAMMA,
} from './__fixtures__/miniLeague'
import type { Match, StandingRow } from '../types'
import { MIN_GAMES } from './reliability'
import {
  MIN_GAMES_FOR_HARDNESS,
  computeScheduleHardness,
  formatExpectedRemainingPoints,
  hardnessGradeLabel,
  hardnessGradeLabelForClub,
} from './schedule'

function row(
  team: { teamId: number; teamName: string; shortName: string },
  partial: Partial<StandingRow> & Pick<StandingRow, 'played' | 'points'>,
): StandingRow {
  const played = partial.played
  const points = partial.points
  const gf = partial.goalsFor ?? Math.max(1, Math.round((points / 3) * played))
  const ga = partial.goalsAgainst ?? Math.max(1, played)
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    shortName: team.shortName,
    teamIconUrl: '',
    played,
    won: partial.won ?? 0,
    draw: partial.draw ?? 0,
    lost: partial.lost ?? 0,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDiff: gf - ga,
    points,
    rank: partial.rank ?? 1,
  }
}

function openMatch(
  matchID: number,
  home: { teamId: number; teamName: string; shortName: string },
  away: { teamId: number; teamName: string; shortName: string },
): Match {
  return {
    matchID,
    matchDateTime: '2025-08-01T15:30:00',
    matchDateTimeUTC: '2025-08-01T13:30:00Z',
    leagueName: 'Test',
    leagueSeason: 2025,
    leagueShortcut: 'test',
    lastUpdateDateTime: '2025-08-01T17:00:00',
    group: { groupName: '2. Spieltag', groupOrderID: 2, groupID: 2 },
    team1: { ...home, teamIconUrl: '' },
    team2: { ...away, teamIconUrl: '' },
    matchIsFinished: false,
    matchResults: [],
    goals: [],
  }
}

describe('computeScheduleHardness (Poisson / Vereinssicht)', () => {
  it('0 Spiele / zu wenige Daten → reliable:false, keine Einstufung', () => {
    const standings: StandingRow[] = [
      row(TEAM_ALPHA, { played: 0, points: 0 }),
      row(TEAM_BETA, { played: 0, points: 0 }),
      row(TEAM_GAMMA, { played: 0, points: 0 }),
      row(TEAM_DELTA, { played: 0, points: 0 }),
    ]
    const matches = [openMatch(1, TEAM_ALPHA, TEAM_BETA)]
    const rows = computeScheduleHardness(matches, standings)
    expect(rows.every((r) => r.reliable === false)).toBe(true)
    expect(rows.every((r) => r.grade === null)).toBe(true)
    expect(MIN_GAMES_FOR_HARDNESS).toBe(MIN_GAMES)
  })

  it('starkes Team vs. schwache Gegner → hohe Restpunkte, leicht für den Verein', () => {
    const played = 10
    const standings: StandingRow[] = [
      row(TEAM_ALPHA, {
        played,
        points: 25,
        goalsFor: 28,
        goalsAgainst: 8,
        rank: 1,
      }),
      row(TEAM_BETA, {
        played,
        points: 5,
        goalsFor: 6,
        goalsAgainst: 22,
        rank: 4,
      }),
      row(TEAM_GAMMA, {
        played,
        points: 6,
        goalsFor: 7,
        goalsAgainst: 20,
        rank: 3,
      }),
      row(TEAM_DELTA, {
        played,
        points: 8,
        goalsFor: 9,
        goalsAgainst: 18,
        rank: 2,
      }),
    ]
    // Alpha (stark) spielt noch gegen zwei schwache Teams
    const matches = [
      openMatch(1, TEAM_ALPHA, TEAM_BETA),
      openMatch(2, TEAM_GAMMA, TEAM_ALPHA),
    ]
    const alpha = computeScheduleHardness(matches, standings).find(
      (r) => r.teamId === TEAM_ALPHA.teamId,
    )!
    expect(alpha.reliable).toBe(true)
    expect(alpha.remainingGames).toBe(2)
    expect(alpha.expectedRemainingPoints).toBeGreaterThan(3)
    expect(alpha.expectedPerGame).toBeGreaterThan(1.5)
    // Starkes Team bleibt oft nahe/über eigenem PPG gegen Schwache → nicht „schwer“
    expect(alpha.grade).not.toBe('hard')
    expect(['easy', 'mid']).toContain(alpha.grade)
  })

  it('schwaches Team vs. starke Gegner → niedrige Restpunkte, schwer für den Verein', () => {
    const played = 10
    const standings: StandingRow[] = [
      row(TEAM_ALPHA, {
        played,
        points: 26,
        goalsFor: 30,
        goalsAgainst: 6,
        rank: 1,
      }),
      row(TEAM_BETA, {
        played,
        points: 24,
        goalsFor: 28,
        goalsAgainst: 8,
        rank: 2,
      }),
      row(TEAM_GAMMA, {
        played,
        points: 4,
        goalsFor: 5,
        goalsAgainst: 25,
        rank: 4,
      }),
      row(TEAM_DELTA, {
        played,
        points: 22,
        goalsFor: 26,
        goalsAgainst: 10,
        rank: 3,
      }),
    ]
    const matches = [
      openMatch(1, TEAM_GAMMA, TEAM_ALPHA),
      openMatch(2, TEAM_BETA, TEAM_GAMMA),
    ]
    const gamma = computeScheduleHardness(matches, standings).find(
      (r) => r.teamId === TEAM_GAMMA.teamId,
    )!
    expect(gamma.reliable).toBe(true)
    expect(gamma.remainingGames).toBe(2)
    expect(gamma.expectedRemainingPoints).toBeLessThan(2)
    expect(gamma.grade).toBe('hard')
  })

  it('identisches Restprogramm, unterschiedlich starke Vereine → unterschiedliche Einstufung', () => {
    const played = 10
    // Alpha Top, Beta Keller — beide noch gegen denselben Top-Gegner (Gamma)
    const standings: StandingRow[] = [
      row(TEAM_ALPHA, {
        played,
        points: 28,
        goalsFor: 36,
        goalsAgainst: 5,
        rank: 1,
      }),
      row(TEAM_BETA, {
        played,
        points: 3,
        goalsFor: 4,
        goalsAgainst: 30,
        rank: 4,
      }),
      row(TEAM_GAMMA, {
        played,
        points: 25,
        goalsFor: 32,
        goalsAgainst: 7,
        rank: 2,
      }),
      row(TEAM_DELTA, {
        played,
        points: 10,
        goalsFor: 12,
        goalsAgainst: 16,
        rank: 3,
      }),
    ]
    const matches = [
      openMatch(1, TEAM_ALPHA, TEAM_GAMMA),
      openMatch(2, TEAM_BETA, TEAM_GAMMA),
    ]
    const rows = computeScheduleHardness(matches, standings)
    const alpha = rows.find((r) => r.teamId === TEAM_ALPHA.teamId)!
    const beta = rows.find((r) => r.teamId === TEAM_BETA.teamId)!

    expect(alpha.remainingGames).toBe(1)
    expect(beta.remainingGames).toBe(1)
    expect(alpha.expectedRemainingPoints).toBeGreaterThan(
      beta.expectedRemainingPoints,
    )
    // Gleicher Gegner: Club-relative Deltas unterscheiden sich klar
    // (Liga-Index aus Gegner-PPG wäre für beide identisch gewesen)
    expect(alpha.difficultyDelta!).toBeLessThan(beta.difficultyDelta!)
    expect(
      Math.abs(alpha.difficultyDelta! - beta.difficultyDelta!),
    ).toBeGreaterThan(0.5)
    expect(alpha.grade).not.toBeNull()
    expect(beta.grade).not.toBeNull()
  })
})

describe('hardness labels / format', () => {
  it('deutsche Labels mit Vereinsbezug', () => {
    expect(hardnessGradeLabel('easy')).toBe('leicht')
    expect(hardnessGradeLabel('mid')).toBe('durchschnittlich')
    expect(hardnessGradeLabel('hard')).toBe('schwer')
    expect(hardnessGradeLabelForClub('hard', 'Köln')).toBe('schwer für Köln')
  })

  it('formatiert erwartete Restpunkte', () => {
    expect(formatExpectedRemainingPoints(12)).toBe('~12')
    expect(formatExpectedRemainingPoints(12.04)).toBe('~12')
    expect(formatExpectedRemainingPoints(12.55)).toMatch(/^~12/)
  })
})
