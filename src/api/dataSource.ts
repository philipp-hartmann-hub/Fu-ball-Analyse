import type { Match } from '../types'
import { getLeague, type League } from '../leagues'
import { fetchMatches } from './openliga'

export function defaultSeason(now = new Date()): number {
  // Saisonstart typisch August
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

export async function fetchLeagueMatches(
  leagueId: string,
  season: number,
): Promise<{ matches: Match[]; league: League }> {
  const league = getLeague(leagueId)
  if (!league) throw new Error(`Unbekannte Liga: ${leagueId}`)

  const matches = await fetchMatches(league.shortcut, season)
  if (!matches.length) {
    throw new Error(
      `Keine Spieldaten für ${league.label} ${season}/${season + 1}. Andere Saison wählen.`,
    )
  }
  return { matches, league }
}
