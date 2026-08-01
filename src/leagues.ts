export type LeagueId = 'bl1' | 'bl2'

export interface League {
  id: LeagueId
  shortcut: 'bl1' | 'bl2'
  label: string
  shortLabel: string
  size: number
}

export const LEAGUES: League[] = [
  { id: 'bl1', shortcut: 'bl1', label: '1. Bundesliga', shortLabel: '1. BL', size: 18 },
  { id: 'bl2', shortcut: 'bl2', label: '2. Bundesliga', shortLabel: '2. BL', size: 18 },
]

export function getLeague(id: string): League | undefined {
  return LEAGUES.find((l) => l.id === id)
}
