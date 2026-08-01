import type { Match } from '../types'
import {
  getCompetition,
  hasFootballDataToken,
  type Competition,
  type DataProvider,
} from '../competitions'
import { fetchFootballDataMatches } from './footballData'
import { fetchMatches as fetchOpenligaMatches } from './openliga'

export function defaultSeason(now = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

function resolveProvider(comp: Competition): DataProvider {
  if (comp.preferredProvider === 'football-data' && hasFootballDataToken()) {
    return 'football-data'
  }
  if (comp.preferredProvider === 'openliga' && comp.openligaShortcut) {
    return 'openliga'
  }
  if (hasFootballDataToken() && comp.footballDataCode) {
    return 'football-data'
  }
  if (comp.openligaShortcut) {
    return 'openliga'
  }
  if (comp.footballDataCode) {
    return 'football-data' // will throw helpful token error
  }
  throw new Error(`Kein Datenprovider für ${comp.label}`)
}

/** OpenLigaDB-Shortcuts können je Saison variieren (UEL/UCL). */
function openligaShortcutFor(comp: Competition, season: number): string {
  if (comp.id === 'el') {
    if (season >= 2025) return 'uel'
    if (season === 2024) return 'uel24'
    return comp.openligaShortcut ?? 'uel'
  }
  if (comp.id === 'cl') {
    return 'ucl'
  }
  return comp.openligaShortcut!
}

export async function fetchCompetitionMatches(
  competitionId: string,
  season: number,
): Promise<{ matches: Match[]; provider: DataProvider; competition: Competition }> {
  const competition = getCompetition(competitionId)
  if (!competition) {
    throw new Error(`Unbekannter Wettbewerb: ${competitionId}`)
  }

  const provider = resolveProvider(competition)

  if (provider === 'football-data') {
    if (!competition.footballDataCode) {
      throw new Error(`${competition.label}: kein football-data Code`)
    }
    const matches = await fetchFootballDataMatches(
      competition.footballDataCode,
      season,
    )
    return { matches, provider, competition }
  }

  const shortcut = openligaShortcutFor(competition, season)
  const matches = await fetchOpenligaMatches(shortcut, season)
  return { matches, provider, competition }
}
