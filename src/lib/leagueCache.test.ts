import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  LEAGUE_CACHE_MAX_AGE_MS,
  readLeagueCache,
  writeLeagueCache,
} from './leagueCache'
import type { League } from '../leagues'
import { MATCH_MD2_ALPHA_GAMMA } from './__fixtures__/miniLeague'

const league: League = {
  id: 'bl1',
  shortcut: 'bl1',
  source: 'openliga',
  label: '1. Bundesliga',
  shortLabel: '1. BL',
  size: 18,
}

function installMemoryStorage() {
  const map = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, String(value))
    },
    removeItem: (key) => {
      map.delete(key)
    },
    key: (index) => [...map.keys()][index] ?? null,
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

describe('leagueCache', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('schreibt und liest gültigen Cache', () => {
    const updatedAt = new Date('2025-08-15T12:00:00Z')
    writeLeagueCache('bl1', 2025, [MATCH_MD2_ALPHA_GAMMA], league, updatedAt, updatedAt.getTime())
    const entry = readLeagueCache('bl1', 2025, updatedAt.getTime())
    expect(entry).not.toBeNull()
    expect(entry!.matches).toHaveLength(1)
    expect(entry!.matches[0].matchID).toBe(MATCH_MD2_ALPHA_GAMMA.matchID)
    expect(entry!.league.id).toBe('bl1')
  })

  it('ignoriert Einträge älter als 24h', () => {
    const savedAt = Date.parse('2025-08-01T00:00:00Z')
    writeLeagueCache(
      'bl1',
      2025,
      [MATCH_MD2_ALPHA_GAMMA],
      league,
      new Date(savedAt),
      savedAt,
    )
    const entry = readLeagueCache(
      'bl1',
      2025,
      savedAt + LEAGUE_CACHE_MAX_AGE_MS + 1,
    )
    expect(entry).toBeNull()
  })

  it('ignoriert kaputtes JSON', () => {
    localStorage.setItem('tabellenblick:league-v1:bl1:2025', '{not-json')
    expect(readLeagueCache('bl1', 2025)).toBeNull()
  })

  it('übersteht fehlenden localStorage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(() =>
      writeLeagueCache('bl1', 2025, [], league, new Date()),
    ).not.toThrow()
    expect(readLeagueCache('bl1', 2025)).toBeNull()
  })
})
