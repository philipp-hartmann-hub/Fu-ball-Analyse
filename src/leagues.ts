export type LeagueId = 'bl1' | 'bl2' | 'bl3' | 'pl' | 'pd' | 'sa' | 'fl1'

export type LeagueSource = 'openliga' | 'fixtures'

export interface League {
  id: LeagueId
  /** OpenLigaDB-Shortcut bzw. Anzeige-Kürzel */
  shortcut: string
  /** fixturedownload.com Feed-Slug (ohne Jahreszahl), z.B. epl */
  feedSlug?: string
  source: LeagueSource
  label: string
  shortLabel: string
  size: number
  /** Community-Feed: kein echtes Live */
  delayedScores?: boolean
}

export const LEAGUES: League[] = [
  {
    id: 'bl1',
    shortcut: 'bl1',
    source: 'openliga',
    label: '1. Bundesliga',
    shortLabel: '1. BL',
    size: 18,
  },
  {
    id: 'bl2',
    shortcut: 'bl2',
    source: 'openliga',
    label: '2. Bundesliga',
    shortLabel: '2. BL',
    size: 18,
  },
  {
    id: 'bl3',
    shortcut: 'bl3',
    source: 'openliga',
    label: '3. Liga',
    shortLabel: '3. Liga',
    size: 20,
  },
  {
    id: 'pl',
    shortcut: 'pl',
    feedSlug: 'epl',
    source: 'fixtures',
    label: 'Premier League',
    shortLabel: 'PL',
    size: 20,
    delayedScores: true,
  },
  {
    id: 'pd',
    shortcut: 'pd',
    feedSlug: 'la-liga',
    source: 'fixtures',
    label: 'La Liga',
    shortLabel: 'LaLiga',
    size: 20,
    delayedScores: true,
  },
  {
    id: 'sa',
    shortcut: 'sa',
    feedSlug: 'serie-a',
    source: 'fixtures',
    label: 'Serie A',
    shortLabel: 'Serie A',
    size: 20,
    delayedScores: true,
  },
  {
    id: 'fl1',
    shortcut: 'fl1',
    feedSlug: 'ligue-1',
    source: 'fixtures',
    label: 'Ligue 1',
    shortLabel: 'Ligue 1',
    size: 18,
    delayedScores: true,
  },
]

export function getLeague(id: string): League | undefined {
  return LEAGUES.find((l) => l.id === id)
}
