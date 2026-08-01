import type { ApiTableRow, LeagueShortcut, Match } from '../types'

const BASE =
  import.meta.env.DEV ? '/api/openliga' : 'https://api.openligadb.de'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`OpenLigaDB ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

export function defaultSeason(now = new Date()): number {
  // Bundesliga-Saison startet üblicherweise im August
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
}

export async function fetchTable(
  league: LeagueShortcut,
  season: number,
): Promise<ApiTableRow[]> {
  return getJson(`/getbltable/${league}/${season}`)
}

export async function fetchMatches(
  league: LeagueShortcut,
  season: number,
): Promise<Match[]> {
  return getJson(`/getmatchdata/${league}/${season}`)
}

export async function fetchLeagueBundle(
  league: LeagueShortcut,
  season: number,
): Promise<{ table: ApiTableRow[]; matches: Match[] }> {
  const [table, matches] = await Promise.all([
    fetchTable(league, season),
    fetchMatches(league, season),
  ])
  return { table, matches }
}

export const LEAGUES: { shortcut: LeagueShortcut; label: string }[] = [
  { shortcut: 'bl1', label: '1. Bundesliga' },
  { shortcut: 'bl2', label: '2. Bundesliga' },
]
