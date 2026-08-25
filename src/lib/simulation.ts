import type { Match, ScenarioResult, StandingRow } from '../types'
import { hasEnoughData } from './reliability'
import {
  applyScore,
  finalResult,
  rankStandings,
  zoneForRank,
  type LeagueZoneId,
  type MatchScore,
  type StandingDraft,
} from './table'

// ——— Modellparameter (bewusst einfach, oben zentral) ———

/** Zusatz-Tore für die Heimmannschaft (~leichter Heimvorteil). */
export const HOME_ADVANTAGE = 0.3

/** Fallback-Angriff (Tore/Spiel), wenn ein Team noch 0 Spiele hat. */
export const DEFAULT_ATTACK = 1.25

/** Fallback-Abwehr (Gegentore/Spiel) bei 0 Spielen. */
export const DEFAULT_DEFENSE = 1.25

/** Untere Schranke für λ, damit Poisson nicht degeneriert. */
export const MIN_LAMBDA = 0.15

/** Obere Schranke für gezogene Tore (Performance + Realismus). */
export const MAX_GOALS = 8

/** Default-Monte-Carlo-Läufe (Worker / UI). */
export const DEFAULT_SIMULATIONS = 10_000

/** Relevante Zonen je Liga (ohne reines Mittelfeld als „Headline“-Pflicht). */
export const FORECAST_ZONES_BL1 = [
  'champion',
  'cl',
  'el',
  'ecl',
  'relegation',
  'direct-relegation',
] as const

export const FORECAST_ZONES_BL2 = [
  'champion',
  'cl',
  'relegation',
  'direct-relegation',
] as const

export const FORECAST_ZONES_BL3 = [
  'champion',
  'cl',
  'direct-relegation',
] as const

export type Rng = () => number

export interface TeamStrength {
  teamId: number
  /** Erwartete eigene Tore je Spiel */
  attack: number
  /** Erwartete Gegentore je Spiel */
  defense: number
}

// ——— Stärkemodell (gegner-adjustiert + Shrinkage) ———

/**
 * Feature-Flag: true = IPF gegen Gegnerstärke + Shrinkage;
 * false = rohe Tore/Spiele (Rollback).
 * Optional per Env: VITE_USE_ADJUSTED_STRENGTH=0
 */
export const USE_ADJUSTED_STRENGTH: boolean = (() => {
  try {
    const env = (import.meta as { env?: Record<string, string> }).env
    const raw = env?.VITE_USE_ADJUSTED_STRENGTH
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* Node/Vitest ohne Vite-Env */
  }
  return true
})()

/** Shrinkage-Pseudo-Spiele: w = played / (played + K). */
export const STRENGTH_SHRINK_K = 5

/** Max. Iterationen für iterative proportional fitting. */
export const STRENGTH_IPF_MAX_ITERS = 10

/** Abbruch, wenn max. relative Änderung unter diesem Wert. */
export const STRENGTH_IPF_EPSILON = 1e-6

/**
 * Minimale Spielzeile für die Stärkeschätzung (Heim/Auswärts + Endstand).
 * MatchScore und gefilterte Matches lassen sich darauf abbilden.
 */
export interface StrengthPlayedMatch {
  homeId: number
  awayId: number
  homeGoals: number
  awayGoals: number
}

export interface DeriveStrengthOptions {
  /** Überschreibt USE_ADJUSTED_STRENGTH für diesen Aufruf. */
  adjusted?: boolean
  /** Shrinkage-K (Default STRENGTH_SHRINK_K). */
  shrinkK?: number
  /**
   * Prior pro Team (Andockpunkt Vorsaison/Elo).
   * Fehlt ein Team → Ligamittel als Shrink-Ziel.
   */
  priorStrength?: ReadonlyMap<number, Pick<TeamStrength, 'attack' | 'defense'>>
  maxIterations?: number
  epsilon?: number
}

/**
 * Multiplikativer Heimfaktor in der IPF-Schätzung —
 * so skaliert, dass bei Ligamittel μ der Boost ≈ HOME_ADVANTAGE (additiv) entspricht:
 * HOME_FACTOR = (μ + HOME_ADVANTAGE) / μ.
 */
export function strengthHomeFactor(leagueAvgGoals: number): number {
  const mu = Math.max(MIN_LAMBDA, leagueAvgGoals)
  return (mu + HOME_ADVANTAGE) / mu
}

function isMatchLike(
  m: Match | StrengthPlayedMatch,
): m is Match {
  return 'team1' in m && 'matchResults' in m
}

/** Normalisiert Match[] oder StrengthPlayedMatch[] auf die IPF-Eingabe. */
export function normalizePlayedMatchesForStrength(
  playedMatches: readonly (Match | StrengthPlayedMatch)[],
): StrengthPlayedMatch[] {
  if (playedMatches.length === 0) return []
  if (!isMatchLike(playedMatches[0]!)) {
    return playedMatches as StrengthPlayedMatch[]
  }
  const out: StrengthPlayedMatch[] = []
  for (const m of playedMatches as Match[]) {
    if (!m.matchIsFinished) continue
    const end = finalResult(m)
    if (!end) continue
    out.push({
      homeId: m.team1.teamId,
      awayId: m.team2.teamId,
      homeGoals: end.pointsTeam1,
      awayGoals: end.pointsTeam2,
    })
  }
  return out
}

export function strengthMatchesFromScores(
  scores: readonly MatchScore[],
): StrengthPlayedMatch[] {
  return scores.map((s) => ({
    homeId: s.homeId,
    awayId: s.awayId,
    homeGoals: s.homeGoals,
    awayGoals: s.awayGoals,
  }))
}

/** Rohe Durchschnitte (Tore/Spiele) — bisheriges Modell / Flag false. */
export function deriveTeamStrengthsRaw(standings: StandingRow[]): {
  strengths: Map<number, TeamStrength>
  avgDefense: number
} {
  const strengths = new Map<number, TeamStrength>()
  let defSum = 0
  let defN = 0

  for (const row of standings) {
    const attack =
      row.played > 0 ? row.goalsFor / row.played : DEFAULT_ATTACK
    const defense =
      row.played > 0 ? row.goalsAgainst / row.played : DEFAULT_DEFENSE
    strengths.set(row.teamId, { teamId: row.teamId, attack, defense })
    defSum += defense
    defN += 1
  }

  const avgDefense = defN > 0 ? defSum / defN : DEFAULT_DEFENSE
  return { strengths, avgDefense }
}

/**
 * Gegner-adjustierte Attack/Defense via iterative proportional fitting,
 * danach Shrinkage zum Ligamittel (oder Prior).
 *
 * Identifizierbarkeit: nach jedem Schritt mean(attack) = mean(defense) = Ligamittel
 * (Tore/Teamspiel), damit die Ratings nicht gemeinsam skalieren.
 * Rückgabe in Tore/Spiel — expectedGoals bleibt unverändert.
 */
export function deriveTeamStrengthsAdjusted(
  standings: StandingRow[],
  playedMatches: readonly StrengthPlayedMatch[],
  options?: Omit<DeriveStrengthOptions, 'adjusted'>,
): {
  strengths: Map<number, TeamStrength>
  avgDefense: number
} {
  const shrinkK = options?.shrinkK ?? STRENGTH_SHRINK_K
  const maxIters = options?.maxIterations ?? STRENGTH_IPF_MAX_ITERS
  const eps = options?.epsilon ?? STRENGTH_IPF_EPSILON
  const prior = options?.priorStrength

  const teamIds = standings.map((s) => s.teamId)
  const idSet = new Set(teamIds)
  const playedById = new Map(standings.map((s) => [s.teamId, s.played] as const))

  const relevant = playedMatches.filter(
    (m) => idSet.has(m.homeId) && idSet.has(m.awayId),
  )

  let goalsSum = 0
  let teamGames = 0
  for (const row of standings) {
    goalsSum += row.goalsFor
    teamGames += row.played
  }
  const leagueAvg =
    teamGames > 0 ? goalsSum / teamGames : (DEFAULT_ATTACK + DEFAULT_DEFENSE) / 2

  if (relevant.length === 0 || teamIds.length === 0) {
    return deriveTeamStrengthsRaw(standings)
  }

  const homeFactor = strengthHomeFactor(leagueAvg)

  // Aggregierte Tore je Team (aus gespielten Zeilen — konsistent zur IPF)
  const gf = new Map<number, number>()
  const ga = new Map<number, number>()
  const gamesPlayed = new Map<number, number>()
  for (const id of teamIds) {
    gf.set(id, 0)
    ga.set(id, 0)
    gamesPlayed.set(id, 0)
  }
  for (const m of relevant) {
    gf.set(m.homeId, (gf.get(m.homeId) ?? 0) + m.homeGoals)
    ga.set(m.homeId, (ga.get(m.homeId) ?? 0) + m.awayGoals)
    gf.set(m.awayId, (gf.get(m.awayId) ?? 0) + m.awayGoals)
    ga.set(m.awayId, (ga.get(m.awayId) ?? 0) + m.homeGoals)
    gamesPlayed.set(m.homeId, (gamesPlayed.get(m.homeId) ?? 0) + 1)
    gamesPlayed.set(m.awayId, (gamesPlayed.get(m.awayId) ?? 0) + 1)
  }

  const attack = new Map<number, number>()
  const defense = new Map<number, number>()
  for (const id of teamIds) {
    const n = gamesPlayed.get(id) ?? 0
    attack.set(
      id,
      n > 0 ? (gf.get(id) ?? 0) / n : leagueAvg,
    )
    defense.set(
      id,
      n > 0 ? (ga.get(id) ?? 0) / n : leagueAvg,
    )
  }

  const normalize = () => {
    let aSum = 0
    let dSum = 0
    let n = 0
    for (const id of teamIds) {
      aSum += attack.get(id) ?? leagueAvg
      dSum += defense.get(id) ?? leagueAvg
      n += 1
    }
    if (n === 0) return
    const aMean = aSum / n
    const dMean = dSum / n
    const aScale = aMean > MIN_LAMBDA ? leagueAvg / aMean : 1
    const dScale = dMean > MIN_LAMBDA ? leagueAvg / dMean : 1
    for (const id of teamIds) {
      attack.set(id, (attack.get(id) ?? leagueAvg) * aScale)
      defense.set(id, (defense.get(id) ?? leagueAvg) * dScale)
    }
  }

  normalize()

  for (let iter = 0; iter < maxIters; iter++) {
    let maxDelta = 0

    const nextAttack = new Map<number, number>()
    for (const id of teamIds) {
      let denom = 0
      for (const m of relevant) {
        if (m.homeId === id) {
          denom += (defense.get(m.awayId) ?? leagueAvg) * homeFactor
        } else if (m.awayId === id) {
          denom += defense.get(m.homeId) ?? leagueAvg
        }
      }
      const scored = gf.get(id) ?? 0
      const n = gamesPlayed.get(id) ?? 0
      let value: number
      if (n === 0 || denom < MIN_LAMBDA) {
        value = attack.get(id) ?? leagueAvg
      } else {
        value = scored / denom
      }
      value = Math.max(MIN_LAMBDA, value)
      const prev = attack.get(id) ?? leagueAvg
      maxDelta = Math.max(maxDelta, Math.abs(value - prev) / Math.max(prev, MIN_LAMBDA))
      nextAttack.set(id, value)
    }
    for (const id of teamIds) {
      attack.set(id, nextAttack.get(id) ?? leagueAvg)
    }

    const nextDefense = new Map<number, number>()
    for (const id of teamIds) {
      let denom = 0
      for (const m of relevant) {
        if (m.homeId === id) {
          // Gegner ist Auswärts → kein Heimfaktor auf deren Angriff
          denom += attack.get(m.awayId) ?? leagueAvg
        } else if (m.awayId === id) {
          // Gegner ist Heim
          denom += (attack.get(m.homeId) ?? leagueAvg) * homeFactor
        }
      }
      const conceded = ga.get(id) ?? 0
      const n = gamesPlayed.get(id) ?? 0
      let value: number
      if (n === 0 || denom < MIN_LAMBDA) {
        value = defense.get(id) ?? leagueAvg
      } else {
        value = conceded / denom
      }
      value = Math.max(MIN_LAMBDA, value)
      const prev = defense.get(id) ?? leagueAvg
      maxDelta = Math.max(maxDelta, Math.abs(value - prev) / Math.max(prev, MIN_LAMBDA))
      nextDefense.set(id, value)
    }
    for (const id of teamIds) {
      defense.set(id, nextDefense.get(id) ?? leagueAvg)
    }

    normalize()

    if (maxDelta < eps) break
  }

  const strengths = new Map<number, TeamStrength>()
  let defSum = 0
  let defN = 0

  for (const row of standings) {
    const id = row.teamId
    const nPlayed = Math.max(
      playedById.get(id) ?? 0,
      gamesPlayed.get(id) ?? 0,
    )
    const priorRow = prior?.get(id)
    const targetAttack = priorRow?.attack ?? leagueAvg
    const targetDefense = priorRow?.defense ?? leagueAvg

    let atk: number
    let def: number
    if (nPlayed <= 0) {
      atk = priorRow?.attack ?? DEFAULT_ATTACK
      def = priorRow?.defense ?? DEFAULT_DEFENSE
    } else {
      const w = nPlayed / (nPlayed + Math.max(0, shrinkK))
      atk = w * (attack.get(id) ?? leagueAvg) + (1 - w) * targetAttack
      def = w * (defense.get(id) ?? leagueAvg) + (1 - w) * targetDefense
    }

    atk = Math.max(MIN_LAMBDA, atk)
    def = Math.max(MIN_LAMBDA, def)
    strengths.set(id, { teamId: id, attack: atk, defense: def })
    defSum += def
    defN += 1
  }

  const avgDefense = defN > 0 ? defSum / defN : DEFAULT_DEFENSE
  return { strengths, avgDefense }
}

/**
 * Teamstärken für Poisson-Modell.
 * Default: gegner-adjustiert + Shrinkage (USE_ADJUSTED_STRENGTH).
 * playedMatches = abgeschlossene Spiele (Match[] oder StrengthPlayedMatch[]).
 * Rückgabe unverändert: { strengths, avgDefense } in Tore/Spiel.
 */
export function deriveTeamStrengths(
  standings: StandingRow[],
  playedMatches: readonly (Match | StrengthPlayedMatch)[] = [],
  options?: DeriveStrengthOptions,
): {
  strengths: Map<number, TeamStrength>
  avgDefense: number
} {
  const useAdjusted = options?.adjusted ?? USE_ADJUSTED_STRENGTH
  if (!useAdjusted) {
    return deriveTeamStrengthsRaw(standings)
  }
  const played = normalizePlayedMatchesForStrength(playedMatches)
  if (played.length === 0) {
    return deriveTeamStrengthsRaw(standings)
  }
  return deriveTeamStrengthsAdjusted(standings, played, options)
}

export interface TeamForecast {
  teamId: number
  expectedPoints: number
  medianRank: number
  /** zoneForRank-Keys → Wahrscheinlichkeit 0..1 (inkl. mid) */
  zoneProbabilities: Record<string, number>
  /** Häufigkeit je Rang (Index 0 = Platz 1) */
  rankCounts: number[]
  /**
   * Punkte je Lauf, gruppiert nach Endrang (Index 0 = Platz 1).
   * Für Wunschplatz-Median; kann leer sein wenn nicht gesammelt.
   */
  pointsByRank?: number[][]
}

export interface SeasonSimulationResult {
  runs: number
  seed: number
  teams: TeamForecast[]
}

export interface SeasonSimulationInput {
  baseStandings: StandingRow[]
  remaining: Match[]
  league: LeagueZoneId
  /** Bereits gesetzte Szenarien: werden nicht neu gezogen */
  fixedScenarios?: ScenarioResult[]
  /** Bereits gezählte Spiele (für DFL-Direktvergleich / Auswärtstore) */
  playedScores?: MatchScore[]
  runs?: number
  seed?: number
  /**
   * Wenn true: Punkte je Endrang sammeln (Wunschplatz-Median).
   * Default false (weniger Speicher / PostMessage-Last).
   */
  collectPointsByRank?: boolean
}

/** Mulberry32 – schneller, seedbarer PRNG in [0,1). */
export function createRng(seed: number): Rng {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Poisson-Ziehung (Knuth); λ wird begrenzt. */
export function samplePoisson(lambda: number, rng: Rng): number {
  const lam = Math.max(MIN_LAMBDA, Math.min(lambda, MAX_GOALS + 2))
  const L = Math.exp(-lam)
  let k = 0
  let p = 1
  do {
    k += 1
    p *= rng()
  } while (p > L && k <= MAX_GOALS + 4)
  return Math.min(MAX_GOALS, k - 1)
}

export function expectedGoals(
  home: TeamStrength,
  away: TeamStrength,
  avgDefense: number,
): { homeLambda: number; awayLambda: number } {
  const scale = avgDefense > 0 ? avgDefense : DEFAULT_DEFENSE
  const homeLambda = Math.max(
    MIN_LAMBDA,
    home.attack * (away.defense / scale) + HOME_ADVANTAGE,
  )
  const awayLambda = Math.max(MIN_LAMBDA, away.attack * (home.defense / scale))
  return { homeLambda, awayLambda }
}

export interface MatchPrediction {
  pHome: number
  pDraw: number
  pAway: number
  likelyScore: { home: number; away: number }
  /** Erwartete Heim-Tore (λ) */
  expHome: number
  /** Erwartete Auswärts-Tore (λ) */
  expAway: number
  /** false → UI zeigt keine Prozente (zu wenige Spiele) */
  reliable: boolean
  /** Gesetztes Szenario hat Vorrang vor Modellschätzung */
  lockedScenario: ScenarioResult | null
}

/** Ab diesem Anteil gilt der Favoriten-Ausgang als „wahrscheinlich“. */
export const MATCH_LEAN_LIKELY_THRESHOLD = 0.5

export type MatchLeanOutcome = 'win' | 'draw' | 'loss'
export type MatchLeanConfidence = 'likely' | 'possible'

/** Kompakte Favoriten-Zeile aus Vereinssicht (Restprogramm / Vergleich). */
export interface MatchLean {
  outcome: MatchLeanOutcome
  confidence: MatchLeanConfidence
  /** Anteil des angezeigten Ausgangs (0–1); bei gesetztem Szenario 1 */
  probability: number
  /** z. B. „Sieg wahrscheinlich“ / „Unentschieden möglich“ */
  label: string
  reliable: boolean
  /** true = Anzeige folgt gesetztem Szenario, nicht dem Modell */
  locked: boolean
}

/** Sieg / Remis / Niederlage aus Sicht von Heim- oder Auswärtsteam. */
export function focusOutcomes(
  prediction: MatchPrediction,
  perspective: 'home' | 'away',
): { win: number; draw: number; loss: number } {
  if (perspective === 'away') {
    return {
      win: prediction.pAway,
      draw: prediction.pDraw,
      loss: prediction.pHome,
    }
  }
  return {
    win: prediction.pHome,
    draw: prediction.pDraw,
    loss: prediction.pAway,
  }
}

function leanLabel(
  outcome: MatchLeanOutcome,
  confidence: MatchLeanConfidence,
): string {
  const base =
    outcome === 'win'
      ? 'Sieg'
      : outcome === 'draw'
        ? 'Unentschieden'
        : 'Niederlage'
  return `${base} ${confidence === 'likely' ? 'wahrscheinlich' : 'möglich'}`
}

/**
 * Wahrscheinlichster Ausgang aus Vereinssicht.
 * „Wahrscheinlich“ ab ≥50 %, sonst „möglich“ (wenn dieser Ausgang der höchste ist).
 */
export function deriveMatchLean(
  prediction: MatchPrediction,
  perspective: 'home' | 'away',
): MatchLean {
  if (prediction.lockedScenario) {
    const { homeGoals, awayGoals } = prediction.lockedScenario
    const focusGoals = perspective === 'home' ? homeGoals : awayGoals
    const oppGoals = perspective === 'home' ? awayGoals : homeGoals
    const outcome: MatchLeanOutcome =
      focusGoals > oppGoals ? 'win' : focusGoals < oppGoals ? 'loss' : 'draw'
    const base =
      outcome === 'win'
        ? 'Sieg'
        : outcome === 'draw'
          ? 'Unentschieden'
          : 'Niederlage'
    return {
      outcome,
      confidence: 'likely',
      probability: 1,
      label: `gesetzt · ${base}`,
      reliable: true,
      locked: true,
    }
  }

  if (!prediction.reliable) {
    return {
      outcome: 'draw',
      confidence: 'possible',
      probability: 0,
      label: 'noch keine Aussage',
      reliable: false,
      locked: false,
    }
  }

  const o = focusOutcomes(prediction, perspective)
  const ranked: [MatchLeanOutcome, number][] = [
    ['win', o.win],
    ['draw', o.draw],
    ['loss', o.loss],
  ]
  let best = ranked[0]!
  for (const entry of ranked) {
    if (entry[1] > best[1]) best = entry
  }
  const [outcome, probability] = best
  const confidence: MatchLeanConfidence =
    probability >= MATCH_LEAN_LIKELY_THRESHOLD ? 'likely' : 'possible'

  return {
    outcome,
    confidence,
    probability,
    label: leanLabel(outcome, confidence),
    reliable: true,
    locked: false,
  }
}

/** Poisson-PMF P(X=k) für k = 0..maxK; Restmasse auf maxK (wie Cap in samplePoisson). */
function truncatedPoissonPmfs(lambda: number, maxK: number): number[] {
  const lam = Math.max(MIN_LAMBDA, Math.min(lambda, maxK + 2))
  const pmf = new Array<number>(maxK + 1)
  let term = Math.exp(-lam)
  let sum = 0
  for (let k = 0; k <= maxK; k++) {
    if (k > 0) term *= lam / k
    pmf[k] = term
    sum += term
  }
  // Cap: verbleibende Masse (k > maxK) dem letzten Bucket zuschlagen
  if (sum < 1 && sum > 0) {
    pmf[maxK]! += 1 - sum
  } else if (sum > 0 && Math.abs(sum - 1) > 1e-12) {
    for (let k = 0; k <= maxK; k++) pmf[k]! /= sum
  }
  return pmf
}

function poissonMode(lambda: number, maxK: number): number {
  if (lambda <= 0) return 0
  // Für Poisson: Modus = floor(λ); bei ganzzahligem λ sind λ und λ−1 gleich häufig —
  // wir nehmen floor(λ) (konsistent, deterministisch).
  return Math.min(maxK, Math.max(0, Math.floor(lambda)))
}

/**
 * Geschlossene 1X2-Schätzung aus Team-Stärken (gleiche λ-Formel wie die Saison-Sim).
 * Keine Monte-Carlo-Läufe — Summe über Torkombinationen 0..MAX_GOALS.
 */
export function predictMatch(
  homeStrength: TeamStrength,
  awayStrength: TeamStrength,
  avgDefense: number,
  options?: { reliable?: boolean; lockedScenario?: ScenarioResult | null },
): MatchPrediction {
  const { homeLambda, awayLambda } = expectedGoals(
    homeStrength,
    awayStrength,
    avgDefense,
  )
  const homeP = truncatedPoissonPmfs(homeLambda, MAX_GOALS)
  const awayP = truncatedPoissonPmfs(awayLambda, MAX_GOALS)

  let pHome = 0
  let pDraw = 0
  let pAway = 0
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = homeP[h]! * awayP[a]!
      if (h > a) pHome += p
      else if (h === a) pDraw += p
      else pAway += p
    }
  }

  const homeMode = poissonMode(homeLambda, MAX_GOALS)
  const awayMode = poissonMode(awayLambda, MAX_GOALS)

  return {
    pHome,
    pDraw,
    pAway,
    likelyScore: { home: homeMode, away: awayMode },
    expHome: homeLambda,
    expAway: awayLambda,
    reliable: options?.reliable ?? true,
    lockedScenario: options?.lockedScenario ?? null,
  }
}

/**
 * Einzelspiel-Schätzung für ein konkretes Match aus der aktuellen Tabelle.
 * Gesetzte Szenarien überschreiben die Anzeige (lockedScenario), Modellwerte bleiben berechenbar.
 */
export function predictFixture(
  baseStandings: StandingRow[],
  match: Match,
  options?: {
    scenarios?: ScenarioResult[]
    /** Abgeschlossene Spiele für gegner-adjustierte Stärken */
    playedMatches?: readonly (Match | StrengthPlayedMatch)[]
    /** Optional vorberechnete Stärken (ein Lauf pro Datenstand) */
    precomputedStrengths?: ReturnType<typeof deriveTeamStrengths>
  },
): MatchPrediction | null {
  const homeRow = baseStandings.find((s) => s.teamId === match.team1.teamId)
  const awayRow = baseStandings.find((s) => s.teamId === match.team2.teamId)
  if (!homeRow || !awayRow) return null

  const { strengths, avgDefense } =
    options?.precomputedStrengths ??
    deriveTeamStrengths(baseStandings, options?.playedMatches ?? [])
  const homeStr =
    strengths.get(match.team1.teamId) ?? {
      teamId: match.team1.teamId,
      attack: DEFAULT_ATTACK,
      defense: DEFAULT_DEFENSE,
    }
  const awayStr =
    strengths.get(match.team2.teamId) ?? {
      teamId: match.team2.teamId,
      attack: DEFAULT_ATTACK,
      defense: DEFAULT_DEFENSE,
    }

  const locked =
    (options?.scenarios ?? []).find((s) => s.matchId === match.matchID) ?? null

  return predictMatch(homeStr, awayStr, avgDefense, {
    reliable: hasEnoughData(baseStandings),
    lockedScenario: locked,
  })
}

function cloneDraft(row: StandingRow): StandingDraft {
  return {
    teamId: row.teamId,
    teamName: row.teamName,
    shortName: row.shortName,
    teamIconUrl: row.teamIconUrl,
    played: row.played,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDiff: row.goalDiff,
    points: row.points,
  }
}

function medianFromCounts(counts: number[], runs: number): number {
  const target = runs / 2
  let cum = 0
  for (let i = 0; i < counts.length; i++) {
    cum += counts[i]!
    if (cum >= target) return i + 1
  }
  return counts.length
}

function relevantZones(league: LeagueZoneId): readonly string[] {
  if (league === 'bl3') return FORECAST_ZONES_BL3
  if (league === 'bl2') return FORECAST_ZONES_BL2
  return FORECAST_ZONES_BL1
}

/**
 * Monte-Carlo-Saisonende: Restspiele per Poisson, feste Szenarien unverändert.
 * Nutzt applyScore + rankStandings (keine duplizierte Tabellenlogik).
 */
export function runSeasonSimulation(
  input: SeasonSimulationInput,
): SeasonSimulationResult {
  const runs = Math.max(1, Math.floor(input.runs ?? DEFAULT_SIMULATIONS))
  const seed = input.seed ?? 1
  const rng = createRng(seed)
  const playedScores = input.playedScores ?? []
  const playedForStrength = strengthMatchesFromScores(playedScores)
  const { strengths, avgDefense } = deriveTeamStrengths(
    input.baseStandings,
    playedForStrength,
  )
  const fixed = new Map(
    (input.fixedScenarios ?? []).map((s) => [s.matchId, s] as const),
  )
  const teamIds = input.baseStandings.map((s) => s.teamId)
  const nTeams = teamIds.length
  const rankCounts = new Map<number, number[]>()
  const pointsSum = new Map<number, number>()
  const zoneCounts = new Map<number, Map<string, number>>()
  const collectPoints = input.collectPointsByRank === true
  const pointsByRank = new Map<number, number[][]>()

  for (const id of teamIds) {
    rankCounts.set(id, Array.from({ length: nTeams }, () => 0))
    pointsSum.set(id, 0)
    zoneCounts.set(id, new Map())
    if (collectPoints) {
      pointsByRank.set(
        id,
        Array.from({ length: nTeams }, () => [] as number[]),
      )
    }
  }

  for (let run = 0; run < runs; run++) {
    const map = new Map<number, StandingDraft>()
    for (const row of input.baseStandings) {
      map.set(row.teamId, cloneDraft(row))
    }

    const runScores: MatchScore[] = [...playedScores]

    for (const match of input.remaining) {
      const locked = fixed.get(match.matchID)
      let homeGoals: number
      let awayGoals: number
      if (locked) {
        homeGoals = locked.homeGoals
        awayGoals = locked.awayGoals
      } else {
        const homeStr =
          strengths.get(match.team1.teamId) ?? {
            teamId: match.team1.teamId,
            attack: DEFAULT_ATTACK,
            defense: DEFAULT_DEFENSE,
          }
        const awayStr =
          strengths.get(match.team2.teamId) ?? {
            teamId: match.team2.teamId,
            attack: DEFAULT_ATTACK,
            defense: DEFAULT_DEFENSE,
          }
        const { homeLambda, awayLambda } = expectedGoals(
          homeStr,
          awayStr,
          avgDefense,
        )
        homeGoals = samplePoisson(homeLambda, rng)
        awayGoals = samplePoisson(awayLambda, rng)
      }
      applyScore(
        map,
        match.team1.teamId,
        match.team2.teamId,
        homeGoals,
        awayGoals,
      )
      runScores.push({
        matchId: match.matchID,
        homeId: match.team1.teamId,
        awayId: match.team2.teamId,
        homeGoals,
        awayGoals,
      })
    }

    const table = rankStandings([...map.values()], { matchScores: runScores })
    for (const row of table) {
      const counts = rankCounts.get(row.teamId)!
      counts[row.rank - 1] = (counts[row.rank - 1] ?? 0) + 1
      pointsSum.set(row.teamId, (pointsSum.get(row.teamId) ?? 0) + row.points)
      const zone = zoneForRank(row.rank, input.league)
      const zmap = zoneCounts.get(row.teamId)!
      zmap.set(zone, (zmap.get(zone) ?? 0) + 1)
      if (collectPoints) {
        pointsByRank.get(row.teamId)![row.rank - 1]!.push(row.points)
      }
    }
  }

  const teams: TeamForecast[] = teamIds.map((teamId) => {
    const counts = rankCounts.get(teamId)!
    const zmap = zoneCounts.get(teamId)!
    const zoneProbabilities: Record<string, number> = { mid: 0 }
    for (const z of relevantZones(input.league)) zoneProbabilities[z] = 0
    for (const [z, c] of zmap) {
      zoneProbabilities[z] = c / runs
    }
    return {
      teamId,
      expectedPoints: (pointsSum.get(teamId) ?? 0) / runs,
      medianRank: medianFromCounts(counts, runs),
      zoneProbabilities,
      rankCounts: counts,
      pointsByRank: collectPoints ? pointsByRank.get(teamId) : undefined,
    }
  })

  return { runs, seed, teams }
}

/** Punkte-Samples aus dem Forecast für einen Zielrang / atLeast. */
export function collectTargetPointsSamples(
  forecast: TeamForecast,
  target: number,
  comparator: 'exact' | 'atLeast',
): number[] {
  const byRank = forecast.pointsByRank
  if (!byRank?.length) return []
  const out: number[] = []
  for (let i = 0; i < byRank.length; i++) {
    const rank = i + 1
    const hit = comparator === 'exact' ? rank === target : rank <= target
    if (!hit) continue
    const bucket = byRank[i]
    if (bucket?.length) out.push(...bucket)
  }
  return out
}

/** Alle Forecast-Zonen inkl. Mittelfeld (Reihenfolge für Summen/Breakdown). */
export function forecastZoneKeys(league: LeagueZoneId): string[] {
  return [...relevantZones(league), 'mid']
}

/** Zone mit höchster Wahrscheinlichkeit (für Tabellen-Headline). */
export function primaryForecastZone(
  forecast: TeamForecast,
  league: LeagueZoneId,
): { zone: string; probability: number } {
  const keys = forecastZoneKeys(league)
  let best = keys[0]!
  let bestP = forecast.zoneProbabilities[best] ?? 0
  for (const z of keys) {
    const p = forecast.zoneProbabilities[z] ?? 0
    if (p > bestP) {
      best = z
      bestP = p
    }
  }
  return { zone: best, probability: bestP }
}

/**
 * Alle Zonen-Wahrscheinlichkeiten, absteigend nach p.
 * Für die Vereinsanalyse (Tabelle zeigt nur die Headline-Zone).
 */
export function forecastZoneBreakdown(
  forecast: TeamForecast,
  league: LeagueZoneId,
): { zone: string; probability: number }[] {
  return forecastZoneKeys(league)
    .map((zone) => ({
      zone,
      probability: forecast.zoneProbabilities[zone] ?? 0,
    }))
    .sort((a, b) => b.probability - a.probability || a.zone.localeCompare(b.zone))
}
