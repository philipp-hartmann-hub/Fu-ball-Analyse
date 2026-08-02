import { describe, expect, it } from 'vitest'
import {
  MATCH_MD2_ALPHA_GAMMA,
  TEAM_ALPHA,
  TEAM_GAMMA,
} from './__fixtures__/miniLeague'
import type { Match } from '../types'
import {
  isLiveMatch,
  listLiveMatches,
  liveMatchesToScenarios,
  liveScoreResult,
  mergeScenarios,
} from './live'

function withKickoff(match: Match, iso: string, finished = false): Match {
  return {
    ...match,
    matchIsFinished: finished,
    matchDateTime: iso,
    matchDateTimeUTC: iso,
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
