import { describe, expect, it } from 'vitest'
import {
  mapFxMatchToMatch,
  parseFxMatchesResponse,
  teamIdFromName,
} from './fixtureDownload'

const fxFinished = {
  MatchNumber: 1,
  RoundNumber: 1,
  DateUtc: '2025-08-15 19:00:00Z',
  Location: 'Anfield',
  HomeTeam: 'Liverpool',
  AwayTeam: 'Bournemouth',
  Group: null,
  HomeTeamScore: 4,
  AwayTeamScore: 2,
  Winner: 'Liverpool',
}

const fxOpen = {
  MatchNumber: 50,
  RoundNumber: 5,
  DateUtc: '2025-09-20 15:00:00Z',
  Location: 'Somewhere',
  HomeTeam: 'Arsenal',
  AwayTeam: 'Chelsea',
  Group: null,
  HomeTeamScore: null,
  AwayTeamScore: null,
  Winner: '',
}

describe('teamIdFromName', () => {
  it('ist stabil und positiv', () => {
    expect(teamIdFromName('Liverpool')).toBe(teamIdFromName('Liverpool'))
    expect(teamIdFromName('Liverpool')).not.toBe(teamIdFromName('Arsenal'))
    expect(teamIdFromName('Liverpool')).toBeGreaterThan(1_000_000)
  })
})

describe('mapFxMatchToMatch', () => {
  it('mappt fertiges Spiel inkl. Type-2-Endstand', () => {
    const m = mapFxMatchToMatch(fxFinished, {
      leagueName: 'Premier League',
      leagueSeason: 2025,
      leagueShortcut: 'pl',
    })
    expect(m.matchIsFinished).toBe(true)
    expect(m.group.groupOrderID).toBe(1)
    expect(m.team1.teamName).toBe('Liverpool')
    expect(m.team2.teamName).toBe('Bournemouth')
    expect(m.matchDateTimeUTC).toBe('2025-08-15T19:00:00Z')
    const end = m.matchResults.find((r) => r.resultTypeID === 2)
    expect(end).toMatchObject({ pointsTeam1: 4, pointsTeam2: 2 })
  })

  it('lässt offene Spiele ohne Results', () => {
    const m = mapFxMatchToMatch(fxOpen, {
      leagueName: 'Premier League',
      leagueSeason: 2025,
      leagueShortcut: 'pl',
    })
    expect(m.matchIsFinished).toBe(false)
    expect(m.matchResults).toHaveLength(0)
  })
})

describe('parseFxMatchesResponse', () => {
  it('parst Fixture-Liste', () => {
    const matches = parseFxMatchesResponse([fxFinished, fxOpen], {
      leagueName: 'Premier League',
      leagueSeason: 2025,
      leagueShortcut: 'pl',
    })
    expect(matches).toHaveLength(2)
    expect(matches[0]!.group.groupOrderID).toBe(1)
    expect(matches[1]!.group.groupOrderID).toBe(5)
  })

  it('wirft bei ungültiger Antwort', () => {
    expect(() =>
      parseFxMatchesResponse({ nope: true }, {
        leagueName: 'PL',
        leagueSeason: 2025,
        leagueShortcut: 'pl',
      }),
    ).toThrow(/fixturedownload-Antwort ungültig/)
  })
})
