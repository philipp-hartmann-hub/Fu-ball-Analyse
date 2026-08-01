import type { Match } from '../types'

const BASE =
  import.meta.env.DEV ? '/api/openliga' : 'https://api.openligadb.de'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`OpenLigaDB ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

export async function fetchMatches(
  leagueShortcut: string,
  season: number,
): Promise<Match[]> {
  return getJson(`/getmatchdata/${leagueShortcut}/${season}`)
}
