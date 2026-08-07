/** API-/Domain-Typen. Match-Form aus Zod-Schema (siehe api/matchSchema.ts). */
export type {
  TeamInfo,
  MatchGroup,
  MatchResult,
  MatchGoal,
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

/** Wie die Platz-Spanne für diesen Verein berechnet wurde. */
export type RangeMode = 'exact' | 'hard'

export interface PositionRange {
  teamId: number
  bestRank: number
  worstRank: number
  /**
   * `exact` = Enumeration der relevanten Restspiele (≤ EXACT_LIMIT).
   * `hard` = Außengrenze aus Punktemaxima (rechnerisch möglich, sound).
   */
  mode: RangeMode
}

/**
 * Mathematisch garantierter Rangbereich (sound, nicht zwingend scharf).
 * True Rank ∈ [hardBest, hardWorst]; oft weiter als Exact.
 */
export interface HardRange {
  teamId: number
  hardBest: number
  hardWorst: number
}

/**
 * Zerlegung eines Best-/Schlechtfall- bzw. Zielplatz-Raums.
 * Klassifikation je Fremdspiel aus den gefilterten optimalen Masken (Menge S der Ausgänge):
 * - |S|==1 → required
 * - |S|==2 → partiallyConstrained (fehlendes Element = forbiddenOutcome)
 * - |S|==3 → flexible („wirklich egal“)
 * Keine Aussage über gemeinsame Kombinierbarkeit der offenen Spiele.
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
    /**
     * Mindest-Tordifferenz bei Sieg/Niederlage, damit dieser Fall (mit den
     * übrigen Bedingungen) erreichbar bleibt. Remis → null.
     */
    minGoalDiff?: number | null
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
   * Fremdspiele mit genau zwei erlaubten Ausgängen (exact).
   * forbiddenOutcome = das eine fehlende 1/X/2-Ergebnis.
   */
  partiallyConstrained: Array<{
    matchId: number
    homeName: string
    awayName: string
    homeIconUrl: string
    awayIconUrl: string
    allowedOutcomes: MatchOutcome[]
    forbiddenOutcome: MatchOutcome
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
  /** Äußere Garantie aus Punktemaxima (enthält immer die angezeigte Spanne) */
  hardRange: HardRange
  fixtureCount: number
  opponentName: string | null
  opponentIconUrl: string | null
  homeAway: 'H' | 'A' | null
  plays: boolean
  bestConditions: CaseConditions | null
  worstConditions: CaseConditions | null
}

/** Saison-Spanne: exakt bei wenigen relevanten Spielen, sonst harte Außengrenze */
export interface SeasonOutlook {
  range: PositionRange
  /** Äußere Garantie aus Punktemaxima (enthält immer die angezeigte Spanne) */
  hardRange: HardRange
  bestConditions: CaseConditions | null
  worstConditions: CaseConditions | null
}
