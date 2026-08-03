import type { Match, MatchResult, ScenarioResult, StandingRow } from '../types'

export function finalResult(match: Match): MatchResult | null {
  if (!match.matchResults?.length) return null
  const end = match.matchResults.find((r) => r.resultTypeID === 2)
  if (end) return end
  return [...match.matchResults].sort((a, b) => b.resultOrderID - a.resultOrderID)[0] ?? null
}

export type StandingDraft = Omit<StandingRow, 'rank'>

/** Aufgelöstes Spielergebnis (fertig oder Szenario) für Tabelle + Direktvergleich. */
export interface MatchScore {
  matchId: number
  homeId: number
  awayId: number
  homeGoals: number
  awayGoals: number
}

export function emptyStanding(
  teamId: number,
  teamName: string,
  shortName: string,
  teamIconUrl: string,
): StandingDraft {
  return {
    teamId,
    teamName,
    shortName,
    teamIconUrl,
    played: 0,
    won: 0,
    draw: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  }
}

/** Wendet ein Spielergebnis auf die Tabellen-Map an (gemeinsam genutzt von buildStandings + Simulation). */
export function applyScore(
  map: Map<number, StandingDraft>,
  homeId: number,
  awayId: number,
  homeGoals: number,
  awayGoals: number,
) {
  const home = map.get(homeId)
  const away = map.get(awayId)
  if (!home || !away) return

  home.played += 1
  away.played += 1
  home.goalsFor += homeGoals
  home.goalsAgainst += awayGoals
  away.goalsFor += awayGoals
  away.goalsAgainst += homeGoals
  home.goalDiff = home.goalsFor - home.goalsAgainst
  away.goalDiff = away.goalsFor - away.goalsAgainst

  if (homeGoals > awayGoals) {
    home.won += 1
    home.points += 3
    away.lost += 1
  } else if (homeGoals < awayGoals) {
    away.won += 1
    away.points += 3
    home.lost += 1
  } else {
    home.draw += 1
    away.draw += 1
    home.points += 1
    away.points += 1
  }
}

/**
 * Löst fertige Spiele + Szenarien zu MatchScore[] auf
 * (gleiche Einschlussregeln wie buildStandings).
 */
export function resolveMatchScores(
  matches: Match[],
  options: {
    maxMatchday?: number | null
    scenarios?: ScenarioResult[]
  } = {},
): MatchScore[] {
  const { maxMatchday = null, scenarios = [] } = options
  const scenarioMap = new Map(scenarios.map((s) => [s.matchId, s]))
  const scores: MatchScore[] = []

  for (const match of matches) {
    const matchday = match.group.groupOrderID
    if (maxMatchday != null && matchday > maxMatchday) continue

    const scenario = scenarioMap.get(match.matchID)
    if (scenario) {
      scores.push({
        matchId: match.matchID,
        homeId: match.team1.teamId,
        awayId: match.team2.teamId,
        homeGoals: scenario.homeGoals,
        awayGoals: scenario.awayGoals,
      })
      continue
    }

    const includeFinished =
      maxMatchday != null ? matchday <= maxMatchday && match.matchIsFinished : match.matchIsFinished
    if (!includeFinished) continue

    const result = finalResult(match)
    if (!result) continue

    scores.push({
      matchId: match.matchID,
      homeId: match.team1.teamId,
      awayId: match.team2.teamId,
      homeGoals: result.pointsTeam1,
      awayGoals: result.pointsTeam2,
    })
  }

  return scores
}

export function awayGoalsFromScores(scores: MatchScore[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const s of scores) {
    map.set(s.awayId, (map.get(s.awayId) ?? 0) + s.awayGoals)
  }
  return map
}

interface H2HStats {
  points: number
  goalDiff: number
  awayGoals: number
}

function emptyH2H(): H2HStats {
  return { points: 0, goalDiff: 0, awayGoals: 0 }
}

/** Mini-Liga nur aus Spielen innerhalb von `teamIds`. */
export function buildHeadToHeadStats(
  teamIds: Iterable<number>,
  scores: MatchScore[],
): Map<number, H2HStats> {
  const idSet = new Set(teamIds)
  const stats = new Map<number, H2HStats>()
  for (const id of idSet) stats.set(id, emptyH2H())

  for (const s of scores) {
    if (!idSet.has(s.homeId) || !idSet.has(s.awayId)) continue
    const home = stats.get(s.homeId)!
    const away = stats.get(s.awayId)!
    home.goalDiff += s.homeGoals - s.awayGoals
    away.goalDiff += s.awayGoals - s.homeGoals
    away.awayGoals += s.awayGoals
    if (s.homeGoals > s.awayGoals) {
      home.points += 3
    } else if (s.homeGoals < s.awayGoals) {
      away.points += 3
    } else {
      home.points += 1
      away.points += 1
    }
  }
  return stats
}

/**
 * Primärvergleich ohne Direktvergleich:
 * Punkte > Tordiff > Tore (Name nur als Notnagel ohne Match-Kontext).
 */
export function compareStandings(
  a: Omit<StandingRow, 'rank'>,
  b: Omit<StandingRow, 'rank'>,
): number {
  if (b.points !== a.points) return b.points - a.points
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
  return a.teamName.localeCompare(b.teamName, 'de')
}

function primaryKey(row: Omit<StandingRow, 'rank'>): string {
  return `${row.points}|${row.goalDiff}|${row.goalsFor}`
}

function compareTiedGroup(
  a: Omit<StandingRow, 'rank'>,
  b: Omit<StandingRow, 'rank'>,
  h2h: Map<number, H2HStats>,
  awayGoals: Map<number, number>,
): number {
  const ha = h2h.get(a.teamId) ?? emptyH2H()
  const hb = h2h.get(b.teamId) ?? emptyH2H()
  if (hb.points !== ha.points) return hb.points - ha.points
  if (hb.goalDiff !== ha.goalDiff) return hb.goalDiff - ha.goalDiff
  if (hb.awayGoals !== ha.awayGoals) return hb.awayGoals - ha.awayGoals
  const aa = awayGoals.get(a.teamId) ?? 0
  const ab = awayGoals.get(b.teamId) ?? 0
  if (ab !== aa) return ab - aa
  return a.teamName.localeCompare(b.teamName, 'de')
}

export interface RankStandingsOptions {
  /** Ergebnisse für H2H + Auswärtstore gesamt (Szenarien müssen schon aufgelöst sein). */
  matchScores?: MatchScore[]
}

/**
 * DFL-Reihenfolge:
 * 1 Punkte 2 Tordiff 3 Tore 4 H2H-Punkte 5 H2H-Tordiff 6 H2H-Auswärtstore
 * 7 Auswärtstore gesamt 8 Name
 */
export function rankStandings(
  rows: Omit<StandingRow, 'rank'>[],
  options: RankStandingsOptions = {},
): StandingRow[] {
  const scores = options.matchScores ?? []
  const awayGoals = awayGoalsFromScores(scores)
  const sorted = [...rows].sort(compareStandings)

  const result: Omit<StandingRow, 'rank'>[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && primaryKey(sorted[j]!) === primaryKey(sorted[i]!)) {
      j += 1
    }
    const group = sorted.slice(i, j)
    if (group.length === 1 || scores.length === 0) {
      result.push(...group)
    } else {
      const h2h = buildHeadToHeadStats(
        group.map((g) => g.teamId),
        scores,
      )
      group.sort((a, b) => compareTiedGroup(a, b, h2h, awayGoals))
      result.push(...group)
    }
    i = j
  }

  return result.map((row, idx) => ({ ...row, rank: idx + 1 }))
}

/** Build table from matches up to (and including) maxMatchday. If null, use finished matches. */
export function buildStandings(
  matches: Match[],
  options: {
    maxMatchday?: number | null
    scenarios?: ScenarioResult[]
  } = {},
): StandingRow[] {
  const scores = resolveMatchScores(matches, options)
  const map = new Map<number, StandingDraft>()

  for (const match of matches) {
    for (const team of [match.team1, match.team2]) {
      if (!map.has(team.teamId)) {
        map.set(
          team.teamId,
          emptyStanding(team.teamId, team.teamName, team.shortName, team.teamIconUrl),
        )
      }
    }
  }

  for (const s of scores) {
    applyScore(map, s.homeId, s.awayId, s.homeGoals, s.awayGoals)
  }

  return rankStandings([...map.values()], { matchScores: scores })
}

export function remainingMatches(
  matches: Match[],
  maxMatchday: number | null = null,
): Match[] {
  if (maxMatchday == null) {
    return matches.filter((m) => !m.matchIsFinished)
  }
  return matches.filter((m) => m.group.groupOrderID > maxMatchday)
}

export function matchdays(matches: Match[]): number[] {
  const set = new Set(matches.map((m) => m.group.groupOrderID))
  return [...set].sort((a, b) => a - b)
}

export function currentMatchday(matches: Match[]): number {
  const unfinished = matches.filter((m) => !m.matchIsFinished)
  if (unfinished.length === 0) {
    const days = matchdays(matches)
    return days[days.length - 1] ?? 1
  }
  return Math.min(...unfinished.map((m) => m.group.groupOrderID))
}

export type LeagueZoneId = 'bl1' | 'bl2' | 'bl3'

/**
 * Erster Abstiegsplatz (für „Vorsprung“-Kennzahl).
 * BL1/BL2: Platz 16 (Relegation) · 3. Liga: Platz 17 (direkter Abstieg).
 */
export function relegationCutoffRank(league: LeagueZoneId): number {
  return league === 'bl3' ? 17 : 16
}

/** Zonenfarben für Tabellenzeilen */
export function zoneForRank(rank: number, league: LeagueZoneId = 'bl1'): string {
  if (league === 'bl3') {
    if (rank <= 2) return 'champion' // Direktaufstieg
    if (rank === 3) return 'cl' // Relegation Aufstieg
    if (rank >= 17) return 'direct-relegation'
    return 'mid'
  }
  if (league === 'bl2') {
    if (rank <= 2) return 'champion' // Aufstieg
    if (rank === 3) return 'cl' // Relegation Aufstieg
    if (rank === 16) return 'relegation'
    if (rank >= 17) return 'direct-relegation'
    return 'mid'
  }
  // 1. Bundesliga
  if (rank === 1) return 'champion'
  if (rank <= 4) return 'cl'
  if (rank === 5) return 'el'
  if (rank === 6) return 'ecl'
  if (rank === 16) return 'relegation'
  if (rank >= 17) return 'direct-relegation'
  return 'mid'
}

export function zoneLabelFor(rank: number, league: LeagueZoneId = 'bl1'): string {
  if (league === 'bl3') {
    if (rank <= 2) return 'Direktaufstieg'
    if (rank === 3) return 'Relegation (Aufstieg)'
    if (rank >= 17) return 'Abstieg'
    return 'Mittelfeld'
  }
  if (league === 'bl2') {
    if (rank <= 2) return 'Direktaufstieg'
    if (rank === 3) return 'Relegation (Aufstieg)'
    if (rank === 16) return 'Relegation (Abstieg)'
    if (rank >= 17) return 'Abstieg'
    return 'Mittelfeld'
  }
  if (rank === 1) return 'Meister'
  if (rank <= 4) return 'Champions League'
  if (rank === 5) return 'Europa League'
  if (rank === 6) return 'Conference League'
  if (rank === 16) return 'Relegation'
  if (rank >= 17) return 'Abstieg'
  return 'Mittelfeld'
}

export const ZONE_LEGEND_BL1: { zone: string; label: string }[] = [
  { zone: 'champion', label: 'Meister' },
  { zone: 'cl', label: 'Champions League' },
  { zone: 'el', label: 'Europa League' },
  { zone: 'ecl', label: 'Conference League' },
  { zone: 'relegation', label: 'Relegation' },
  { zone: 'direct-relegation', label: 'Abstieg' },
]

export const ZONE_LEGEND_BL2: { zone: string; label: string }[] = [
  { zone: 'champion', label: 'Direktaufstieg' },
  { zone: 'cl', label: 'Relegation Aufstieg' },
  { zone: 'relegation', label: 'Relegation Abstieg' },
  { zone: 'direct-relegation', label: 'Abstieg' },
]

export const ZONE_LEGEND_BL3: { zone: string; label: string }[] = [
  { zone: 'champion', label: 'Direktaufstieg' },
  { zone: 'cl', label: 'Relegation Aufstieg' },
  { zone: 'direct-relegation', label: 'Abstieg' },
]
