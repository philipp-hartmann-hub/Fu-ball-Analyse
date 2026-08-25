import { describe, expect, it } from 'vitest'
import {
  TEAM_ALPHA,
  TEAM_BETA,
  TEAM_DELTA,
  TEAM_GAMMA,
} from './__fixtures__/miniLeague'
import type { Match, MatchResult, StandingRow, TeamInfo } from '../types'
import { MIN_GAMES } from './reliability'
import {
  TREND_CLEAR_DOWN_MAX,
  TREND_CLEAR_UP_MIN,
  TREND_WINDOW,
  computeTeamTrend,
  gradeFromTrendScore,
  trendGradeLabel,
} from './trend'

function row(
  team: TeamInfo,
  partial: Partial<StandingRow> & Pick<StandingRow, 'played' | 'points'>,
): StandingRow {
  const gf = partial.goalsFor ?? 10
  const ga = partial.goalsAgainst ?? 10
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    shortName: team.shortName,
    teamIconUrl: '',
    played: partial.played,
    won: partial.won ?? 0,
    draw: partial.draw ?? 0,
    lost: partial.lost ?? 0,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDiff: gf - ga,
    points: partial.points,
    rank: partial.rank ?? 1,
  }
}

function endResult(home: number, away: number): MatchResult {
  return {
    resultID: 2,
    resultName: 'Endergebnis',
    pointsTeam1: home,
    pointsTeam2: away,
    resultOrderID: 2,
    resultTypeID: 2,
  }
}

function finishedMatch(
  matchID: number,
  day: number,
  home: TeamInfo,
  away: TeamInfo,
  homeGoals: number,
  awayGoals: number,
): Match {
  return {
    matchID,
    matchDateTime: `2025-09-${String(day).padStart(2, '0')}T15:30:00`,
    matchDateTimeUTC: `2025-09-${String(day).padStart(2, '0')}T13:30:00Z`,
    leagueName: 'Mini-Liga',
    leagueSeason: 2025,
    leagueShortcut: 'mini',
    lastUpdateDateTime: `2025-09-${String(day).padStart(2, '0')}T17:00:00`,
    group: {
      groupName: `${day}. Spieltag`,
      groupOrderID: day,
      groupID: 1000 + day,
    },
    team1: home,
    team2: away,
    matchIsFinished: true,
    matchResults: [endResult(homeGoals, awayGoals)],
    goals: [],
  }
}

/** Starke Liga: Alpha top, Beta Midfield-Fokus, Gamma/Delta Keller. */
function strongWeakStandings(focusPlayed: number): StandingRow[] {
  return [
    row(TEAM_ALPHA, {
      played: Math.max(MIN_GAMES, focusPlayed),
      points: 28,
      goalsFor: 40,
      goalsAgainst: 8,
      rank: 1,
    }),
    row(TEAM_BETA, {
      played: focusPlayed,
      points: Math.max(5, focusPlayed),
      goalsFor: 12,
      goalsAgainst: 14,
      rank: 2,
    }),
    row(TEAM_GAMMA, {
      played: Math.max(MIN_GAMES, focusPlayed),
      points: 4,
      goalsFor: 6,
      goalsAgainst: 30,
      rank: 3,
    }),
    row(TEAM_DELTA, {
      played: Math.max(MIN_GAMES, focusPlayed),
      points: 3,
      goalsFor: 5,
      goalsAgainst: 32,
      rank: 4,
    }),
  ]
}

describe('gradeFromTrendScore', () => {
  it('stuft klar positiv / negativ korrekt ein', () => {
    expect(gradeFromTrendScore(TREND_CLEAR_UP_MIN)).toBe('up')
    expect(gradeFromTrendScore(0)).toBe('stable')
    expect(gradeFromTrendScore(TREND_CLEAR_DOWN_MAX)).toBe('down')
    expect(trendGradeLabel('up')).toBe('Aufwärtstrend')
    expect(trendGradeLabel('down')).toBe('Abwärtstrend')
  })
})

describe('computeTeamTrend', () => {
  it('schlägt starke Gegner über Erwartung → Aufwärtstrend', () => {
    const played = TREND_WINDOW
    const standings = strongWeakStandings(played)
    // Beta schlägt Alpha (Spitze) mehrmals — klar über Erwartung
    const matches: Match[] = []
    for (let i = 1; i <= TREND_WINDOW; i++) {
      matches.push(
        finishedMatch(i, i, TEAM_BETA, TEAM_ALPHA, 2, 0),
      )
    }
    const trend = computeTeamTrend(TEAM_BETA.teamId, matches, standings)
    expect(trend.reliable).toBe(true)
    expect(trend.sampleSize).toBe(TREND_WINDOW)
    expect(trend.trendScore).toBeGreaterThanOrEqual(TREND_CLEAR_UP_MIN)
    expect(trend.grade).toBe('up')
  })

  it('verliert gegen schwache Gegner unter Erwartung → Abwärtstrend', () => {
    const played = TREND_WINDOW
    const standings = strongWeakStandings(played)
    // Alpha (stark) verliert gegen Keller — klar unter Erwartung
    const matches: Match[] = []
    for (let i = 1; i <= TREND_WINDOW; i++) {
      const home = i % 2 === 1
      matches.push(
        home
          ? finishedMatch(i, i, TEAM_ALPHA, TEAM_GAMMA, 0, 2)
          : finishedMatch(i, i, TEAM_DELTA, TEAM_ALPHA, 2, 0),
      )
    }
    const trend = computeTeamTrend(TEAM_ALPHA.teamId, matches, standings)
    expect(trend.reliable).toBe(true)
    expect(trend.trendScore).toBeLessThanOrEqual(TREND_CLEAR_DOWN_MAX)
    expect(trend.grade).toBe('down')
  })

  it('gleiche Punkteausbeute: stärkere Gegner → besserer Trend', () => {
    const played = TREND_WINDOW
    const standings = strongWeakStandings(played)

    // Beta: fünf Remis gegen Alpha (Spitze)
    const vsStrong: Match[] = []
    for (let i = 1; i <= TREND_WINDOW; i++) {
      vsStrong.push(finishedMatch(100 + i, i, TEAM_BETA, TEAM_ALPHA, 1, 1))
    }
    // Gamma: fünf Remis gegen Delta (beide schwach) — gleiche 5 Punkte
    const vsWeak: Match[] = []
    for (let i = 1; i <= TREND_WINDOW; i++) {
      vsWeak.push(finishedMatch(200 + i, i, TEAM_GAMMA, TEAM_DELTA, 1, 1))
    }

    const againstStrong = computeTeamTrend(
      TEAM_BETA.teamId,
      vsStrong,
      standings,
    )
    const againstWeak = computeTeamTrend(TEAM_GAMMA.teamId, vsWeak, standings)

    expect(againstStrong.reliable).toBe(true)
    expect(againstWeak.reliable).toBe(true)
    expect(againstStrong.trendScore).toBeGreaterThan(againstWeak.trendScore)
  })

  it('< N Spiele → noch kein Trend', () => {
    const standings = strongWeakStandings(TREND_WINDOW)
    const matches = [
      finishedMatch(1, 1, TEAM_BETA, TEAM_GAMMA, 1, 0),
      finishedMatch(2, 2, TEAM_DELTA, TEAM_BETA, 0, 1),
    ]
    // Team hat nur 2 Finished, auch wenn played in Tabelle höher stünde
    const lowPlayed = standings.map((s) =>
      s.teamId === TEAM_BETA.teamId ? { ...s, played: 2 } : s,
    )
    const trend = computeTeamTrend(TEAM_BETA.teamId, matches, lowPlayed)
    expect(trend.reliable).toBe(false)
    expect(trend.grade).toBeNull()
    expect(trend.sampleSize).toBeLessThan(TREND_WINDOW)
  })

  it('Liga unter MIN_GAMES → kein Trend trotz genug Finished', () => {
    const early = strongWeakStandings(TREND_WINDOW).map((s) => ({
      ...s,
      played: MIN_GAMES - 1,
    }))
    const matches: Match[] = []
    for (let i = 1; i <= TREND_WINDOW; i++) {
      matches.push(finishedMatch(i, i, TEAM_BETA, TEAM_GAMMA, 2, 0))
    }
    const trend = computeTeamTrend(TEAM_BETA.teamId, matches, early)
    expect(trend.reliable).toBe(false)
    expect(trend.grade).toBeNull()
  })
})
