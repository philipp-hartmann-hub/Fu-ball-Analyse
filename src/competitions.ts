export type CompetitionKind = 'domestic' | 'europe' | 'nations'
export type DataProvider = 'openliga' | 'football-data'

export interface Competition {
  id: string
  label: string
  shortLabel: string
  kind: CompetitionKind
  /** OpenLigaDB leagueShortcut, if provider supports it */
  openligaShortcut?: string
  /** football-data.org competition code */
  footballDataCode?: string
  preferredProvider: DataProvider
  /** Team count hint for zone coloring */
  typicalSize: number
}

export const COMPETITIONS: Competition[] = [
  // Top 5 + 2. Liga
  {
    id: 'bl1',
    label: '1. Bundesliga',
    shortLabel: 'BL1',
    kind: 'domestic',
    openligaShortcut: 'bl1',
    footballDataCode: 'BL1',
    preferredProvider: 'openliga',
    typicalSize: 18,
  },
  {
    id: 'bl2',
    label: '2. Bundesliga',
    shortLabel: 'BL2',
    kind: 'domestic',
    openligaShortcut: 'bl2',
    footballDataCode: 'BL2',
    preferredProvider: 'openliga',
    typicalSize: 18,
  },
  {
    id: 'pl',
    label: 'Premier League',
    shortLabel: 'PL',
    kind: 'domestic',
    openligaShortcut: 'epl',
    footballDataCode: 'PL',
    preferredProvider: 'football-data',
    typicalSize: 20,
  },
  {
    id: 'pd',
    label: 'La Liga',
    shortLabel: 'PD',
    kind: 'domestic',
    openligaShortcut: 'la1',
    footballDataCode: 'PD',
    preferredProvider: 'football-data',
    typicalSize: 20,
  },
  {
    id: 'sa',
    label: 'Serie A',
    shortLabel: 'SA',
    kind: 'domestic',
    footballDataCode: 'SA',
    preferredProvider: 'football-data',
    typicalSize: 20,
  },
  {
    id: 'fl1',
    label: 'Ligue 1',
    shortLabel: 'FL1',
    kind: 'domestic',
    footballDataCode: 'FL1',
    preferredProvider: 'football-data',
    typicalSize: 18,
  },
  // UEFA club
  {
    id: 'cl',
    label: 'Champions League',
    shortLabel: 'UCL',
    kind: 'europe',
    openligaShortcut: 'ucl',
    footballDataCode: 'CL',
    preferredProvider: 'football-data',
    typicalSize: 36,
  },
  {
    id: 'el',
    label: 'Europa League',
    shortLabel: 'UEL',
    kind: 'europe',
    openligaShortcut: 'uel24',
    footballDataCode: 'EL',
    preferredProvider: 'football-data',
    typicalSize: 36,
  },
  {
    id: 'ecl',
    label: 'Conference League',
    shortLabel: 'UECL',
    kind: 'europe',
    footballDataCode: 'ECL',
    preferredProvider: 'football-data',
    typicalSize: 36,
  },
  // Nations
  {
    id: 'nla',
    label: 'Nations League A',
    shortLabel: 'UNL',
    kind: 'nations',
    openligaShortcut: 'nla',
    preferredProvider: 'openliga',
    typicalSize: 16,
  },
]

export const COMPETITION_GROUPS: { kind: CompetitionKind; label: string }[] = [
  { kind: 'domestic', label: 'Top-Ligen Europa' },
  { kind: 'europe', label: 'UEFA Klubwettbewerbe' },
  { kind: 'nations', label: 'Nationalmannschaften' },
]

export function getCompetition(id: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.id === id)
}

export function hasFootballDataToken(): boolean {
  return Boolean(import.meta.env.VITE_FOOTBALL_DATA_TOKEN?.trim())
}
