import type { League } from '../leagues'
import type { Match } from '../types'
import { matchesResponseSchema } from '../api/matchSchema'

const CACHE_PREFIX = 'tabellenblick:league-v1:'
/** Einträge älter als 24h werden ignoriert. */
export const LEAGUE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface LeagueCacheEntry {
  leagueId: string
  season: number
  matches: Match[]
  league: League
  /** Zeitpunkt der Daten (ISO) */
  updatedAt: string
  /** Wann der Cache geschrieben wurde */
  savedAt: number
}

function cacheKey(leagueId: string, season: number): string {
  return `${CACHE_PREFIX}${leagueId}:${season}`
}

function canUseStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const probe = '__tb_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

/**
 * Liest Cache für Liga/Saison. null bei Fehlern, Alter > 24h oder ungültigen Daten.
 */
export function readLeagueCache(
  leagueId: string,
  season: number,
  nowMs: number = Date.now(),
): LeagueCacheEntry | null {
  const storage = canUseStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(cacheKey(leagueId, season))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const entry = parsed as Partial<LeagueCacheEntry>
    if (
      entry.leagueId !== leagueId ||
      entry.season !== season ||
      typeof entry.savedAt !== 'number' ||
      typeof entry.updatedAt !== 'string' ||
      !entry.league ||
      typeof entry.league !== 'object'
    ) {
      return null
    }
    if (nowMs - entry.savedAt > LEAGUE_CACHE_MAX_AGE_MS) return null

    const matchesParsed = matchesResponseSchema.safeParse(entry.matches)
    if (!matchesParsed.success) return null

    return {
      leagueId,
      season,
      matches: matchesParsed.data,
      league: entry.league as League,
      updatedAt: entry.updatedAt,
      savedAt: entry.savedAt,
    }
  } catch {
    return null
  }
}

/** Speichert erfolgreichen Fetch. Fehler (Private Mode etc.) werden still ignoriert. */
export function writeLeagueCache(
  leagueId: string,
  season: number,
  matches: Match[],
  league: League,
  updatedAt: Date,
  nowMs: number = Date.now(),
): void {
  const storage = canUseStorage()
  if (!storage) return

  const entry: LeagueCacheEntry = {
    leagueId,
    season,
    matches,
    league,
    updatedAt: updatedAt.toISOString(),
    savedAt: nowMs,
  }

  try {
    storage.setItem(cacheKey(leagueId, season), JSON.stringify(entry))
  } catch {
    // Quota / Private Mode – Cache ist optional
  }
}
