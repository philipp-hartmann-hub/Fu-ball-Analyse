/** API-/Domain-Typen. Match-Form aus Zod-Schema (siehe api/matchSchema.ts). */
export type {
  TeamInfo,
  MatchGroup,
  MatchResult,
  Match,
} from './api/matchSchema'

export interface ApiTableRow {
  teamInfoId: number
  teamName: string
  shortName: string
  teamIconUrl: string
  points: number
  opponentGoals: number
  goals: number
  matches: number
  won: number
  lost: number
  draw: number
  goalDiff: number
}

export interface StandingRow {
  teamId: number
  teamName: string
  shortName: string
  teamIconUrl: string
  played: number
  won: number
  draw: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  rank: number
}

export type MatchOutcome = 'home' | 'draw' | 'away'

/** User-defined result for an unfinished match */
export interface ScenarioResult {
  matchId: number
  homeGoals: number
  awayGoals: number
}

export interface PositionRange {
  teamId: number
  bestRank: number
  worstRank: number
}

/** Best-/Schlechtfall nach dem nächsten Spieltag */
export interface NextMatchdayOutlook {
  matchday: number
  range: PositionRange
  fixtureCount: number
  opponentName: string | null
  plays: boolean
}

/** Saison-Spanne (heuristisch) */
export interface SeasonOutlook {
  range: PositionRange
}
