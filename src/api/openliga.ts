import type { Match } from '../types'
import { parseMatchesResponse } from './matchSchema'

const BASE =
  import.meta.env.DEV ? '/api/openliga' : 'https://api.openligadb.de'

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`OpenLigaDB ${res.status}: ${path}`)
  }
  return res.json()
}

export async function fetchMatches(
  leagueShortcut: string,
  season: number,
): Promise<Match[]> {
  const raw = await getJson(`/getmatchdata/${leagueShortcut}/${season}`)
  return parseMatchesResponse(raw)
}

export { parseMatchesResponse, formatOpenLigaParseError, matchSchema } from './matchSchema'
