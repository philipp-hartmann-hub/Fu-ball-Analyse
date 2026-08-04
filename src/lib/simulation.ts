import type { Match, ScenarioResult, StandingRow } from '../types'
import {
  applyScore,
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

export function deriveTeamStrengths(standings: StandingRow[]): {
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
  const { strengths, avgDefense } = deriveTeamStrengths(input.baseStandings)
  const fixed = new Map(
    (input.fixedScenarios ?? []).map((s) => [s.matchId, s] as const),
  )
  const playedScores = input.playedScores ?? []
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
