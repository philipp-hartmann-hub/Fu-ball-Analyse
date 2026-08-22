import { describe, expect, it } from 'vitest'
import {
  TEAM_ALPHA,
  TEAM_BETA,
  TEAM_DELTA,
  TEAM_GAMMA,
} from './__fixtures__/miniLeague'
import type { Match, StandingRow, TeamInfo } from '../types'
import { MIN_GAMES } from './reliability'
import {
  HARDNESS_HARD_MIN,
  HARDNESS_VERY_EASY_MIN,
  MIN_GAMES_FOR_HARDNESS,
  clampGradeForLossMajority,
  computeScheduleHardness,
  gradeFromExpectedPerGame,
  hardnessGradeLabel,
  hardnessGradeLabelForClub,
  type HardnessGrade,
} from './schedule'
import { deriveTeamStrengths } from './simulation'

function row(
  team: { teamId: number; teamName: string; shortName: string },
  partial: Partial<StandingRow> & Pick<StandingRow, 'played' | 'points'>,
): StandingRow {
  const played = partial.played
  const points = partial.points
  const gf = partial.goalsFor ?? Math.max(1, Math.round((points / 3) * played) || 1)
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

function team(id: number, name: string): TeamInfo {
  return {
    teamId: id,
    teamName: name,
    shortName: name.slice(0, 3),
    teamIconUrl: '',
  }
}

describe('gradeFromExpectedPerGame / clamp', () => {
  it('absolute Schwellen', () => {
    expect(gradeFromExpectedPerGame(2.0)).toBe('very-easy')
    expect(gradeFromExpectedPerGame(HARDNESS_VERY_EASY_MIN)).toBe('very-easy')
    expect(gradeFromExpectedPerGame(1.7)).toBe('easy')
    expect(gradeFromExpectedPerGame(1.4)).toBe('mid')
    expect(gradeFromExpectedPerGame(1.0)).toBe('hard')
    expect(gradeFromExpectedPerGame(HARDNESS_HARD_MIN)).toBe('hard')
    expect(gradeFromExpectedPerGame(0.89)).toBe('very-hard')
  })

  it('Loss-Mehrheit clamppt leicht/mittel auf schwer', () => {
    expect(clampGradeForLossMajority('very-easy', 0.6)).toBe('hard')
    expect(clampGradeForLossMajority('easy', 0.51)).toBe('hard')
    expect(clampGradeForLossMajority('mid', 0.7)).toBe('hard')
    expect(clampGradeForLossMajority('hard', 0.8)).toBe('hard')
    expect(clampGradeForLossMajority('very-hard', 1)).toBe('very-hard')
    expect(clampGradeForLossMajority('easy', 0.5)).toBe('easy')
  })
})

describe('computeScheduleHardness (absolut / Vereinssicht)', () => {
  it('0 Spiele → keine Stufe', () => {
    const standings: StandingRow[] = [
      row(TEAM_ALPHA, { played: 0, points: 0 }),
      row(TEAM_BETA, { played: 0, points: 0 }),
      row(TEAM_GAMMA, { played: 0, points: 0 }),
      row(TEAM_DELTA, { played: 0, points: 0 }),
    ]
    const rows = computeScheduleHardness(
      [openMatch(1, TEAM_ALPHA, TEAM_BETA)],
      standings,
    )
    expect(rows.every((r) => r.reliable === false)).toBe(true)
    expect(rows.every((r) => r.grade === null)).toBe(true)
    expect(MIN_GAMES_FOR_HARDNESS).toBe(MIN_GAMES)
  })

  it('Köln-Regressionsfall: schwach vs. starke Gegner → sehr schwer (nicht leicht)', () => {
    const played = 10
    const koeln = team(18, 'Köln')
    const strongA = team(1, 'Bayern')
    const strongB = team(2, 'Dortmund')
    const strongC = team(3, 'Leipzig')
    const mid = team(10, 'Freiburg')
    const standings: StandingRow[] = [
      row(strongA, {
        played,
        points: 28,
        goalsFor: 35,
        goalsAgainst: 6,
        rank: 1,
      }),
      row(strongB, {
        played,
        points: 25,
        goalsFor: 30,
        goalsAgainst: 8,
        rank: 2,
      }),
      row(strongC, {
        played,
        points: 22,
        goalsFor: 28,
        goalsAgainst: 10,
        rank: 3,
      }),
      row(mid, {
        played,
        points: 14,
        goalsFor: 14,
        goalsAgainst: 14,
        rank: 10,
      }),
      row(koeln, {
        played,
        points: 3,
        goalsFor: 4,
        goalsAgainst: 28,
        rank: 18,
      }),
    ]
    const matches = [
      openMatch(1, koeln, strongA),
      openMatch(2, strongB, koeln),
      openMatch(3, koeln, strongC),
      openMatch(4, mid, koeln),
    ]
    const k = computeScheduleHardness(matches, standings).find(
      (r) => r.teamId === koeln.teamId,
    )!
    expect(k.reliable).toBe(true)
    expect(k.expectedPerGame).toBeLessThan(HARDNESS_HARD_MIN)
    expect(k.grade).toBe('very-hard')
    expect(k.grade).not.toBe('easy')
    expect(k.grade).not.toBe('very-easy')
  })

  it('precomputedStrengths liefert dasselbe wie frischer deriveTeamStrengths-Lauf', () => {
    const played = 10
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
        points: 4,
        goalsFor: 5,
        goalsAgainst: 28,
        rank: 4,
      }),
      row(TEAM_GAMMA, {
        played,
        points: 5,
        goalsFor: 6,
        goalsAgainst: 26,
        rank: 3,
      }),
      row(TEAM_DELTA, {
        played,
        points: 6,
        goalsFor: 7,
        goalsAgainst: 24,
        rank: 2,
      }),
    ]
    const matches = [
      openMatch(1, TEAM_ALPHA, TEAM_BETA),
      openMatch(2, TEAM_GAMMA, TEAM_ALPHA),
      openMatch(3, TEAM_ALPHA, TEAM_DELTA),
    ]
    const precomputed = deriveTeamStrengths(standings)
    const baseline = computeScheduleHardness(matches, standings)
    const reused = computeScheduleHardness(matches, standings, { precomputedStrengths: precomputed })
    expect(reused).toEqual(baseline)
    const partial = computeScheduleHardness(matches, standings, {
      precomputedStrengths: precomputed,
      onlyTeamIds: [TEAM_ALPHA.teamId],
    })
    expect(partial).toHaveLength(1)
    expect(partial[0]).toEqual(baseline.find((r) => r.teamId === TEAM_ALPHA.teamId))
  })

  it('starkes Team gegen schwache Gegner → sehr leicht', () => {
    const played = 10
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
        points: 4,
        goalsFor: 5,
        goalsAgainst: 28,
        rank: 4,
      }),
      row(TEAM_GAMMA, {
        played,
        points: 5,
        goalsFor: 6,
        goalsAgainst: 26,
        rank: 3,
      }),
      row(TEAM_DELTA, {
        played,
        points: 6,
        goalsFor: 7,
        goalsAgainst: 24,
        rank: 2,
      }),
    ]
    const matches = [
      openMatch(1, TEAM_ALPHA, TEAM_BETA),
      openMatch(2, TEAM_GAMMA, TEAM_ALPHA),
      openMatch(3, TEAM_ALPHA, TEAM_DELTA),
    ]
    const alpha = computeScheduleHardness(matches, standings).find(
      (r) => r.teamId === TEAM_ALPHA.teamId,
    )!
    expect(alpha.expectedPerGame).toBeGreaterThanOrEqual(HARDNESS_VERY_EASY_MIN)
    expect(alpha.grade).toBe('very-easy')
  })

  it('identisches Restprogramm, unterschiedlich starke Vereine → unterschiedliche Stufe', () => {
    const played = 10
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
        points: 12,
        goalsFor: 12,
        goalsAgainst: 14,
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
    expect(alpha.expectedPerGame).toBeGreaterThan(beta.expectedPerGame)
    expect(alpha.grade).not.toBe(beta.grade)
  })

  it('Konsistenz: Mehrheit Niederlage wahrscheinlich → schwer/sehr schwer, nie leicht', () => {
    const played = 10
    const weak = TEAM_DELTA
    const standings: StandingRow[] = [
      row(TEAM_ALPHA, {
        played,
        points: 27,
        goalsFor: 34,
        goalsAgainst: 6,
        rank: 1,
      }),
      row(TEAM_BETA, {
        played,
        points: 24,
        goalsFor: 30,
        goalsAgainst: 8,
        rank: 2,
      }),
      row(TEAM_GAMMA, {
        played,
        points: 22,
        goalsFor: 28,
        goalsAgainst: 9,
        rank: 3,
      }),
      row(weak, {
        played,
        points: 2,
        goalsFor: 3,
        goalsAgainst: 32,
        rank: 4,
      }),
    ]
    const matches = [
      openMatch(1, weak, TEAM_ALPHA),
      openMatch(2, TEAM_BETA, weak),
      openMatch(3, weak, TEAM_GAMMA),
    ]
    const w = computeScheduleHardness(matches, standings).find(
      (r) => r.teamId === weak.teamId,
    )!
    expect(w.lossLikelyShare).toBeGreaterThan(0.5)
    expect(['hard', 'very-hard']).toContain(w.grade)
    expect(w.grade).not.toBe('easy')
    expect(w.grade).not.toBe('very-easy')
  })

  it('Verteilung bei ausgeglichener Liga: Extreme selten, Mitte häufig', () => {
    const played = 12
    // Sechs ähnlich starke Teams → Restspiele untereinander ≈ mittlere expectedPerGame
    const teams = Array.from({ length: 6 }, (_, i) =>
      team(i + 1, `T${i + 1}`),
    )
    const standings: StandingRow[] = teams.map((t, i) =>
      row(t, {
        played,
        points: 16 + (i % 3),
        goalsFor: 16 + (i % 2),
        goalsAgainst: 15 + ((i + 1) % 2),
        rank: i + 1,
      }),
    )
    const matches: Match[] = []
    let id = 1
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push(openMatch(id++, teams[i]!, teams[j]!))
      }
    }
    const rows = computeScheduleHardness(matches, standings).filter(
      (r) => r.remainingGames > 0 && r.grade,
    )
    expect(rows.length).toBe(6)
    const counts = new Map<HardnessGrade, number>()
    for (const r of rows) {
      counts.set(r.grade!, (counts.get(r.grade!) ?? 0) + 1)
    }
    const extreme =
      (counts.get('very-easy') ?? 0) + (counts.get('very-hard') ?? 0)
    const middle =
      (counts.get('easy') ?? 0) +
      (counts.get('mid') ?? 0) +
      (counts.get('hard') ?? 0)
    expect(middle).toBeGreaterThan(extreme)
    expect(middle).toBeGreaterThanOrEqual(Math.ceil(rows.length / 2))
  })
})

describe('hardness labels', () => {
  it('fünf deutsche Stufen', () => {
    expect(hardnessGradeLabel('very-easy')).toBe('sehr leicht')
    expect(hardnessGradeLabel('easy')).toBe('leicht')
    expect(hardnessGradeLabel('mid')).toBe('mittel')
    expect(hardnessGradeLabel('hard')).toBe('schwer')
    expect(hardnessGradeLabel('very-hard')).toBe('sehr schwer')
    expect(hardnessGradeLabelForClub('very-hard', 'Köln')).toBe(
      'sehr schwer für Köln',
    )
  })
})
