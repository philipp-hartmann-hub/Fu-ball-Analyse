import { describe, expect, it } from 'vitest'
import {
  decodeShareState,
  encodeShareState,
  loadShareStateFromSearch,
  readShareParam,
  replaceShareQuery,
  shouldPersistShare,
  type ShareState,
} from './shareState'

const sample: ShareState = {
  leagueId: 'bl2',
  season: 2024,
  useCutoff: true,
  asOfMatchday: 12,
  scenarios: [
    { matchId: 42001, homeGoals: 2, awayGoals: 1 },
    { matchId: 42002, homeGoals: 0, awayGoals: 0 },
  ],
}

describe('shareState encode/decode', () => {
  it('Round-Trip: decode(encode(state)) === state', () => {
    const token = encodeShareState(sample)
    expect(decodeShareState(token)).toEqual(sample)
  })

  it('Round-Trip: encode(decode(token)) === token', () => {
    const token = encodeShareState(sample)
    const again = encodeShareState(decodeShareState(token)!)
    expect(again).toBe(token)
  })

  it('nimmt Liga und Saison mit (keine MatchId-Kollisionen über Saisons)', () => {
    const a = encodeShareState({ ...sample, leagueId: 'bl1', season: 2023 })
    const b = encodeShareState({ ...sample, leagueId: 'bl1', season: 2024 })
    expect(a).not.toBe(b)
    expect(decodeShareState(a)?.season).toBe(2023)
    expect(decodeShareState(b)?.season).toBe(2024)
  })

  it('clampt Tore beim Encode', () => {
    const token = encodeShareState({
      ...sample,
      useCutoff: false,
      asOfMatchday: null,
      scenarios: [{ matchId: 1, homeGoals: -3, awayGoals: 120 }],
    })
    expect(decodeShareState(token)?.scenarios).toEqual([
      { matchId: 1, homeGoals: 0, awayGoals: 99 },
    ])
  })

  it('ohne Cutoff: c=null, useCutoff false', () => {
    const token = encodeShareState({
      ...sample,
      useCutoff: false,
      asOfMatchday: 5,
    })
    expect(decodeShareState(token)).toMatchObject({
      useCutoff: false,
      asOfMatchday: null,
    })
  })

  it('ignoriert fehlerhafte Tokens robust', () => {
    expect(decodeShareState('')).toBeNull()
    expect(decodeShareState('%%%')).toBeNull()
    expect(decodeShareState(encodeShareState(sample).slice(0, 4))).toBeNull()
    // gültiges Base64, ungültige Struktur
    const bad = btoa(JSON.stringify({ v: 99, l: 'bl1', y: 2024 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    expect(decodeShareState(bad)).toBeNull()
    expect(decodeShareState(btoa(JSON.stringify({ v: 1, l: 'xx', y: 2024 })).replace(/=+$/g, ''))).toBeNull()
  })

  it('überspringt kaputte Szenario-Einträge, crasht nicht', () => {
    const wire = {
      v: 1,
      l: 'bl1',
      y: 2025,
      c: null,
      s: [
        [10, 1, 0],
        'nope',
        [0, 1, 1],
        [11, 'x', 2],
        [12, 3, 4],
      ],
    }
    const token = btoa(JSON.stringify(wire))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    expect(decodeShareState(token)?.scenarios).toEqual([
      { matchId: 10, homeGoals: 1, awayGoals: 0 },
      { matchId: 12, homeGoals: 3, awayGoals: 4 },
    ])
  })
})

describe('shareState URL helpers', () => {
  it('readShareParam / loadShareStateFromSearch', () => {
    const token = encodeShareState(sample)
    expect(readShareParam(`?s=${token}&x=1`)).toBe(token)
    expect(loadShareStateFromSearch(`?s=${encodeURIComponent(token)}`)).toEqual(sample)
    expect(loadShareStateFromSearch('')).toBeNull()
    expect(loadShareStateFromSearch('?s=!!!')).toBeNull()
  })

  it('shouldPersistShare nur bei gesetzten Szenarien', () => {
    expect(shouldPersistShare(sample)).toBe(true)
    expect(
      shouldPersistShare({
        ...sample,
        scenarios: [],
      }),
    ).toBe(false)
  })

  it('replaceShareQuery setzt und entfernt s', () => {
    const token = encodeShareState(sample)
    const withS = replaceShareQuery(token, 'https://example.com/app')
    expect(withS).toContain(`s=${token}`)
    const cleared = replaceShareQuery(null, withS)
    expect(cleared).not.toContain('s=')
    expect(cleared).toBe('https://example.com/app')
  })
})
