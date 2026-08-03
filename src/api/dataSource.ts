import type { Match } from '../types'
import { getLeague, type League } from '../leagues'
import { fetchFixtureDownloadMatches } from './fixtureDownload'
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

  let matches: Match[]
  if (league.source === 'fixtures') {
    if (!league.feedSlug) {
      throw new Error(`Kein Fixture-Feed für ${league.label}`)
    }
    matches = await fetchFixtureDownloadMatches(league.feedSlug, season, {
      leagueName: league.label,
      leagueShortcut: league.shortcut,
    })
  } else {
    matches = await fetchMatches(league.shortcut, season)
  }

  if (!matches.length) {
    throw new Error(
      `Keine Spieldaten für ${league.label} ${season}/${season + 1}. Andere Saison wählen.`,
    )
  }
  return { matches, league }
}
