export interface TeamInfo {
  teamId: number
  teamName: string
  shortName: string
  teamIconUrl: string
}

export interface MatchGroup {
  groupName: string
  groupOrderID: number
  groupID: number
}

export interface MatchResult {
  resultID: number
  resultName: string
  pointsTeam1: number
  pointsTeam2: number
  resultOrderID: number
  resultTypeID: number
}

export interface Match {
  matchID: number
  matchDateTime: string
  matchDateTimeUTC: string
  leagueName: string
  leagueSeason: number
  leagueShortcut: string
  group: MatchGroup
  team1: TeamInfo
  team2: TeamInfo
  matchIsFinished: boolean
  matchResults: MatchResult[]
  lastUpdateDateTime: string
}

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

export interface PathwayStep {
  matchId: number
  homeName: string
  awayName: string
  homeGoals: number
  awayGoals: number
  /** Tippschein-Notation */
  tip: '1' | 'X' | '2'
  involvesFocus: boolean
}

export interface ScenarioPathway {
  rank: number
  steps: PathwayStep[]
}

/** Best-/Schlechtfall nach dem nächsten Spieltag inkl. Pathways */
export interface NextMatchdayOutlook {
  matchday: number
  range: PositionRange
  fixtureCount: number
  opponentName: string | null
  plays: boolean
  bestPathway: ScenarioPathway
  worstPathway: ScenarioPathway
}

/** Saison-Spanne inkl. heuristischer Pathways */
export interface SeasonOutlook {
  range: PositionRange
  bestPathway: ScenarioPathway
  worstPathway: ScenarioPathway
}
