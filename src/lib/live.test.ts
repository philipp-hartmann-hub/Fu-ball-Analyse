import { describe, expect, it } from 'vitest'
import {
  MATCH_MD2_ALPHA_GAMMA,
  TEAM_ALPHA,
  TEAM_GAMMA,
} from './__fixtures__/miniLeague'
import type { Match } from '../types'
import {
  halfTimeResult,
  isLiveMatch,
  listLiveMatches,
  listMatchGoals,
  listMatchdayFixtures,
  liveMatchesToScenarios,
  liveScoreResult,
  mergeScenarios,
  resolveResultsMatchday,
} from './live'

function withKickoff(match: Match, iso: string, finished = false): Match {
  return {
    ...match,
    matchIsFinished: finished,
    matchDateTime: iso,
    matchDateTimeUTC: iso,
  }
}

function withDay(match: Match, day: number): Match {
  return {
    ...match,
    matchID: match.matchID + day * 1000,
    group: {
      groupName: `${day}. Spieltag`,
      groupOrderID: day,
      groupID: 1000 + day,
    },
  }
}

describe('isLiveMatch / listLiveMatches', () => {
  const now = Date.parse('2025-08-15T16:00:00Z')

  it('erkennt laufendes Spiel mit Zwischenstand', () => {
    const live = withKickoff(MATCH_MD2_ALPHA_GAMMA, '2025-08-15T15:30:00Z', false)
    live.matchResults = [
      {
        resultID: 1,
        resultName: 'Zwischenstand',
        pointsTeam1: 1,
        pointsTeam2: 0,
        resultOrderID: 1,
        resultTypeID: 1,
      },
    ]
    expect(isLiveMatch(live, now)).toBe(true)
    const list = listLiveMatches([live], now)
    expect(list).toHaveLength(1)
    expect(list[0].homeGoals).toBe(1)
    expect(list[0].awayGoals).toBe(0)
    expect(list[0].hasScore).toBe(true)
  })

  it('ignoriert fertige und zukünftige Spiele', () => {
    const finished = withKickoff(MATCH_MD2_ALPHA_GAMMA, '2025-08-15T14:00:00Z', true)
    const future = withKickoff(MATCH_MD2_ALPHA_GAMMA, '2025-08-15T17:00:00Z', false)
    expect(isLiveMatch(finished, now)).toBe(false)
    expect(isLiveMatch(future, now)).toBe(false)
  })

  it('schneidet zu alte „lebende“ Spiele ab', () => {
    const ancient = withKickoff(MATCH_MD2_ALPHA_GAMMA, '2025-08-15T08:00:00Z', false)
    expect(isLiveMatch(ancient, now)).toBe(false)
  })
})

describe('liveScoreResult', () => {
  it('nimmt höchste resultOrderID', () => {
    const m = withKickoff(MATCH_MD2_ALPHA_GAMMA, '2025-08-15T15:30:00Z')
    m.matchResults = [
      {
        resultID: 1,
        resultName: 'A',
        pointsTeam1: 0,
        pointsTeam2: 0,
        resultOrderID: 1,
        resultTypeID: 1,
      },
      {
        resultID: 2,
        resultName: 'B',
        pointsTeam1: 2,
        pointsTeam2: 1,
        resultOrderID: 5,
        resultTypeID: 1,
      },
    ]
    expect(liveScoreResult(m)?.pointsTeam1).toBe(2)
  })
})

describe('resolveResultsMatchday', () => {
  it('zeigt Spieltag noch 2 Tage nach letztem Spiel', () => {
    const md1 = withKickoff(
      withDay(MATCH_MD2_ALPHA_GAMMA, 1),
      '2025-08-10T15:30:00Z',
      true,
    )
    const md2 = withKickoff(
      withDay(MATCH_MD2_ALPHA_GAMMA, 2),
      '2025-08-20T15:30:00Z',
      false,
    )
    // 1 Tag nach MD1 → noch MD1
    expect(
      resolveResultsMatchday([md1, md2], Date.parse('2025-08-11T16:00:00Z')),
    ).toBe(1)
  })

  it('wechselt nach Hold-Fenster auf den nächsten Spieltag', () => {
    const md1 = withKickoff(
      withDay(MATCH_MD2_ALPHA_GAMMA, 1),
      '2025-08-10T15:30:00Z',
      true,
    )
    const md2 = withKickoff(
      withDay(MATCH_MD2_ALPHA_GAMMA, 2),
      '2025-08-20T15:30:00Z',
      false,
    )
    // > 2 Tage nach MD1 → MD2
    expect(
      resolveResultsMatchday([md1, md2], Date.parse('2025-08-13T16:00:00Z')),
    ).toBe(2)
  })
})

describe('listMatchdayFixtures', () => {
  it('liefert finished/live/upcoming Status', () => {
    const now = Date.parse('2025-08-15T16:00:00Z')
    const finished = withKickoff(
      withDay(MATCH_MD2_ALPHA_GAMMA, 3),
      '2025-08-15T13:00:00Z',
      true,
    )
    finished.matchResults = [
      {
        resultID: 1,
        resultName: 'Endergebnis',
        pointsTeam1: 2,
        pointsTeam2: 1,
        resultOrderID: 2,
        resultTypeID: 2,
      },
    ]
    const live = withKickoff(
      { ...withDay(MATCH_MD2_ALPHA_GAMMA, 3), matchID: 301 },
      '2025-08-15T15:30:00Z',
      false,
    )
    live.matchResults = [
      {
        resultID: 2,
        resultName: 'Zwischenstand',
        pointsTeam1: 0,
        pointsTeam2: 1,
        resultOrderID: 1,
        resultTypeID: 1,
      },
    ]
    const upcoming = withKickoff(
      { ...withDay(MATCH_MD2_ALPHA_GAMMA, 3), matchID: 302 },
      '2025-08-15T18:30:00Z',
      false,
    )
    const rows = listMatchdayFixtures([finished, live, upcoming], 3, now)
    expect(rows.map((r) => r.status)).toEqual(['finished', 'live', 'upcoming'])
  })
})

describe('liveMatchesToScenarios / mergeScenarios', () => {
  it('baut Szenarien und lässt User gewinnen', () => {
    const live = listLiveMatches(
      [
        {
          ...withKickoff(MATCH_MD2_ALPHA_GAMMA, '2025-08-15T15:30:00Z'),
          matchResults: [
            {
              resultID: 1,
              resultName: 'Live',
              pointsTeam1: 1,
              pointsTeam2: 1,
              resultOrderID: 1,
              resultTypeID: 1,
            },
          ],
        },
      ],
      Date.parse('2025-08-15T16:00:00Z'),
    )
    const scenarios = liveMatchesToScenarios(live)
    expect(scenarios).toEqual([
      { matchId: MATCH_MD2_ALPHA_GAMMA.matchID, homeGoals: 1, awayGoals: 1 },
    ])
    const merged = mergeScenarios(scenarios, [
      { matchId: MATCH_MD2_ALPHA_GAMMA.matchID, homeGoals: 3, awayGoals: 0 },
    ])
    expect(merged[0]).toEqual({
      matchId: MATCH_MD2_ALPHA_GAMMA.matchID,
      homeGoals: 3,
      awayGoals: 0,
    })
    expect(TEAM_ALPHA.teamId).toBe(1)
    expect(TEAM_GAMMA.teamId).toBe(3)
  })
})

describe('listMatchGoals / halfTimeResult', () => {
  it('sortiert Tore und erkennt Heim/Auswärts', () => {
    const match: Match = {
      ...MATCH_MD2_ALPHA_GAMMA,
      matchIsFinished: true,
      matchResults: [
        {
          resultID: 1,
          resultName: 'Halbzeitergebnis',
          pointsTeam1: 1,
          pointsTeam2: 0,
          resultOrderID: 1,
          resultTypeID: 1,
        },
        {
          resultID: 2,
          resultName: 'Endergebnis',
          pointsTeam1: 2,
          pointsTeam2: 1,
          resultOrderID: 2,
          resultTypeID: 2,
        },
      ],
      goals: [
        {
          goalID: 2,
          scoreTeam1: 1,
          scoreTeam2: 1,
          matchMinute: 55,
          goalGetterName: 'Away Scorer',
          scoringTeamId: TEAM_GAMMA.teamId,
          isPenalty: false,
          isOwnGoal: false,
          isOvertime: false,
        },
        {
          goalID: 1,
          scoreTeam1: 1,
          scoreTeam2: 0,
          matchMinute: 12,
          goalGetterName: 'Home Scorer',
          scoringTeamId: TEAM_ALPHA.teamId,
          isPenalty: true,
          isOwnGoal: false,
          isOvertime: false,
        },
        {
          goalID: 3,
          scoreTeam1: 2,
          scoreTeam2: 1,
          matchMinute: 80,
          goalGetterName: 'Home Two',
          scoringTeamId: TEAM_ALPHA.teamId,
          isPenalty: false,
          isOwnGoal: false,
          isOvertime: false,
        },
      ],
    }

    const ht = halfTimeResult(match)
    expect(ht?.pointsTeam1).toBe(1)
    expect(ht?.pointsTeam2).toBe(0)

    const goals = listMatchGoals(match)
    expect(goals.map((g) => g.name)).toEqual([
      'Home Scorer',
      'Away Scorer',
      'Home Two',
    ])
    expect(goals[0].side).toBe('home')
    expect(goals[0].isPenalty).toBe(true)
    expect(goals[1].side).toBe('away')
    expect(goals[0].scoreLabel).toBe('1:0')
  })
})
