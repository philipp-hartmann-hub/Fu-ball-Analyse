/** API-/Domain-Typen. Match-Form aus Zod-Schema (siehe api/matchSchema.ts). */
export type {
  TeamInfo,
  MatchGroup,
  MatchResult,
  Match,
} from './api/matchSchema'

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

/**
 * Zerlegung eines Best-/Schlechtfall- bzw. Zielplatz-Raums.
 * exact: „required“ gilt in JEDEM optimalen Weg (bei fixer eigener Vorgabe).
 * partiallyConstrained: Ausgang eingeschränkt (nicht alle 3 möglich), aber nicht eindeutig.
 * Keine Aussage über gemeinsame Kombinierbarkeit der flexiblen Spiele.
 */
export interface CaseConditions {
  mode: 'exact' | 'heuristic'
  /** Eigenes Spiel (Spieltag) bzw. null wenn spielfrei */
  ownMatch: {
    matchId: number
    opponentName: string
    opponentIconUrl: string
    homeAway: 'H' | 'A'
    /** Rohes Match-Ergebnis */
    outcome: MatchOutcome
    /** Aus Sicht des Fokusvereins */
    focusResult: 'win' | 'draw' | 'loss'
  } | null
  /** Saison-Heuristik: alle eigenen Restspiele als Vorgabe */
  ownRest: Array<{
    matchId: number
    opponentName: string
    opponentIconUrl: string
    homeAway: 'H' | 'A'
    focusResult: 'win' | 'loss'
    outcome: MatchOutcome
  }>
  /**
   * Notwendige Fremdergebnisse (exact): in jedem optimalen Weg gleich.
   * Heuristik: leer — siehe relevantRivals.
   */
  required: Array<{
    matchId: number
    homeName: string
    awayName: string
    homeIconUrl: string
    awayIconUrl: string
    outcome: MatchOutcome
  }>
  /**
   * Fremdspiele mit eingeschränktem, aber nicht eindeutigem Ausgang (exact).
   * z.B. „nicht Auswärtssieg“ → allowedOutcomes length 2.
   */
  partiallyConstrained: Array<{
    matchId: number
    homeName: string
    awayName: string
    homeIconUrl: string
    awayIconUrl: string
    allowedOutcomes: MatchOutcome[]
  }>
  /** Fremdspiele ohne festen Ausgang (exact) bzw. ohne Einfluss (Heuristik) */
  flexible: Array<{
    matchId: number
    homeName: string
    awayName: string
    homeIconUrl: string
    awayIconUrl: string
  }>
  /** Heuristik: Konkurrenten in Tabellen-Reichweite */
  relevantRivals: Array<{
    teamId: number
    teamName: string
    teamIconUrl: string
    points: number
    rank: number
  }>
  /** Anzahl optimaler Kombinationen (exact); bei Heuristik 0 */
  totalWays: number
}

export type TargetComparator = 'exact' | 'atLeast'

/** Eigene Ausgänge, die das Ziel ebenfalls erreichen (neben dem Default in ownMatch). */
export interface TargetOwnOption {
  focusResult: 'win' | 'draw' | 'loss'
  outcome: MatchOutcome
  /** Kurzhinweis für die UI */
  label: string
}

export interface TargetSeasonStats {
  /** P(Rang == target) */
  pExact: number
  /** P(Rang <= target) */
  pAtLeast: number
  /** Median-Punkte in Läufen, die das Ziel erfüllen; null wenn keine */
  medianPoints: number | null
  /** medianPoints − aktuelle Punkte; null wenn medianPoints fehlt */
  pointsNeeded: number | null
}

/** Wunschplatz: Spieltag (exakt) und/oder Saison (Sim + Heuristik). */
export interface TargetOutlook {
  target: number
  comparator: TargetComparator
  reachable: boolean
  /** Nächstliegender erreichbarer Rang, wenn reachable=false */
  nearestReachable?: number
  conditions?: CaseConditions
  /** Weitere eigene Ausgänge, die das Ziel auch erreichen */
  ownOptions?: TargetOwnOption[]
  season?: TargetSeasonStats
}

/** Best-/Schlechtfall nach dem nächsten Spieltag */
export interface NextMatchdayOutlook {
  matchday: number
  range: PositionRange
  fixtureCount: number
  opponentName: string | null
  opponentIconUrl: string | null
  homeAway: 'H' | 'A' | null
  plays: boolean
  bestConditions: CaseConditions | null
  worstConditions: CaseConditions | null
}

/** Saison-Spanne (heuristisch) */
export interface SeasonOutlook {
  range: PositionRange
  bestConditions: CaseConditions | null
  worstConditions: CaseConditions | null
}
