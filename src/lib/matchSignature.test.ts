import { describe, expect, it, vi } from 'vitest'
import {
  MATCH_MD1_ALPHA_BETA,
  MATCH_MD2_ALPHA_GAMMA,
  MINI_LEAGUE_MATCHES,
} from './__fixtures__/miniLeague'
import {
  matchesContentSignature,
  matchesDataVersion,
} from './matchSignature'

describe('matchesContentSignature', () => {
  it('identische Inhalte → gleiche Signatur', () => {
    const a = matchesContentSignature(MINI_LEAGUE_MATCHES)
    const b = matchesContentSignature([...MINI_LEAGUE_MATCHES])
    expect(a).toBe(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('ändert sich bei Endstand / finished / lastUpdate', () => {
    const base = matchesContentSignature([MATCH_MD2_ALPHA_GAMMA])
    const finished = {
      ...MATCH_MD2_ALPHA_GAMMA,
      matchIsFinished: true,
      matchResults: MATCH_MD1_ALPHA_BETA.matchResults,
    }
    expect(matchesContentSignature([finished])).not.toBe(base)

    const touched = {
      ...MATCH_MD2_ALPHA_GAMMA,
      lastUpdateDateTime: '2099-01-01T00:00:00',
    }
    expect(matchesContentSignature([touched])).not.toBe(base)
  })

  it('matchesDataVersion spiegelt Content-Signatur', () => {
    expect(matchesDataVersion(MINI_LEAGUE_MATCHES)).toBe(
      matchesContentSignature(MINI_LEAGUE_MATCHES),
    )
  })
})

describe('load(silent) Signatur-Gate (Logik)', () => {
  it('bei gleicher Signatur weder matches-Referenz noch updatedAt ändern', () => {
    let matches = MINI_LEAGUE_MATCHES
    let updatedAt: Date | null = new Date('2026-01-01T12:00:00Z')
    const prevMatches = matches
    const prevUpdated = updatedAt

    const incoming = [...MINI_LEAGUE_MATCHES]
    const same =
      matchesContentSignature(incoming) === matchesContentSignature(matches)
    expect(same).toBe(true)
    if (!same) {
      matches = incoming
      updatedAt = new Date()
    }

    expect(matches).toBe(prevMatches)
    expect(updatedAt).toBe(prevUpdated)
  })

  it('vi-spy: setMatches wird bei gleicher Signatur nicht aufgerufen', () => {
    const setMatches = vi.fn()
    const setUpdatedAt = vi.fn()
    const writeCache = vi.fn()
    const current = MINI_LEAGUE_MATCHES
    const next = [...MINI_LEAGUE_MATCHES]

    if (matchesContentSignature(next) === matchesContentSignature(current)) {
      // early exit
    } else {
      setMatches(next)
      setUpdatedAt(new Date())
      writeCache()
    }

    expect(setMatches).not.toHaveBeenCalled()
    expect(setUpdatedAt).not.toHaveBeenCalled()
    expect(writeCache).not.toHaveBeenCalled()
  })
})
