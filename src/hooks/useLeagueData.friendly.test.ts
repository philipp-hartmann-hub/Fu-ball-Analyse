import { describe, expect, it, vi } from 'vitest'
import { friendlyLoadError } from '../hooks/useLeagueData'

describe('friendlyLoadError', () => {
  it('gibt deutsche Texte und loggt Details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(friendlyLoadError(new Error('Failed to fetch'))).toMatch(/Verbindung/)
    expect(friendlyLoadError(new Error('invalid json from api'))).toMatch(/gelesen/)
    expect(friendlyLoadError('x')).toMatch(/nicht geladen/)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
