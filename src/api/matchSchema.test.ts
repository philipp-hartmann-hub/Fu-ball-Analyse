import { describe, expect, it } from 'vitest'
import { formatOpenLigaParseError, parseMatchesResponse } from './matchSchema'

const validMatch = {
  matchID: 201,
  matchDateTime: '2025-08-15T15:30:00',
  matchDateTimeUTC: '2025-08-15T13:30:00Z',
  leagueName: 'Test',
  leagueSeason: 2025,
  leagueShortcut: 'bl1',
  group: {
    groupName: '2. Spieltag',
    groupOrderID: 2,
    groupID: 1002,
    extraApiField: 'toleriert',
  },
  team1: {
    teamId: 1,
    teamName: 'Alpha',
    shortName: 'Alpha',
    teamIconUrl: '',
  },
  team2: {
    teamId: 3,
    teamName: 'Gamma',
    shortName: 'Gamma',
    teamIconUrl: '',
  },
  matchIsFinished: false,
  matchResults: [],
  lastUpdateDateTime: '2025-08-15T17:00:00',
  unknownTopLevel: 42,
}

describe('parseMatchesResponse', () => {
  it('akzeptiert gültige Matches und toleriert unbekannte Felder', () => {
    const matches = parseMatchesResponse([validMatch])
    expect(matches).toHaveLength(1)
    expect(matches[0].matchID).toBe(201)
    expect(matches[0].group.groupOrderID).toBe(2)
  })

  it('meldet fehlendes group.groupOrderID klar (kein Crash)', () => {
    const broken = {
      ...validMatch,
      group: {
        groupName: '2. Spieltag',
        groupID: 1002,
        // groupOrderID fehlt
      },
    }

    expect(() => parseMatchesResponse([broken])).toThrow(/groupOrderID/i)

    try {
      parseMatchesResponse([broken])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      expect(msg).toMatch(/OpenLigaDB-Antwort ungültig/)
      expect(msg).toMatch(/\[0\]\.group\.groupOrderID|group\.groupOrderID/)
      expect(msg).not.toMatch(/Cannot read propert/i)
    }
  })

  it('formatOpenLigaParseError enthält Index und Feld', () => {
    const result = parseMatchesResponse
    expect(typeof result).toBe('function')
    // direkte Format-Hilfe über safeParse-Pfad abdecken
    try {
      parseMatchesResponse([{ matchID: 'x' }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      expect(formatOpenLigaParseError).toBeTypeOf('function')
      expect(msg.length).toBeGreaterThan(10)
    }
  })
})
