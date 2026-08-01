import type {
  Match,
  NextMatchdayOutlook,
  PositionRange,
  ScenarioResult,
  StandingRow,
} from '../types'
import { buildStandings, compareStandings, remainingMatches } from './table'

function cloneRow(row: StandingRow): StandingRow {
  return { ...row }
}

function applyOutcome(
  standings: Map<number, StandingRow>,
  homeId: number,
  awayId: number,
  homeGoals: number,
  awayGoals: number,
) {
  const home = standings.get(homeId)
  const away = standings.get(awayId)
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

function rankOf(standings: StandingRow[], teamId: number): number {
  const sorted = [...standings].sort(compareStandings)
  return sorted.findIndex((s) => s.teamId === teamId) + 1
}

const OUTCOMES: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
]

/**
 * Saison-Rest: Best-/Schlechtfall heuristisch über alle offenen Spiele.
 */
export function computePositionRanges(
  baseStandings: StandingRow[],
  remaining: Match[],
): PositionRange[] {
  return baseStandings.map((team) => {
    const bestRank = simulateExtreme(baseStandings, remaining, team.teamId, 'best')
    const worstRank = simulateExtreme(baseStandings, remaining, team.teamId, 'worst')
    return {
      teamId: team.teamId,
      bestRank: Math.min(bestRank, worstRank),
      worstRank: Math.max(bestRank, worstRank),
    }
  })
}

function simulateExtreme(
  baseStandings: StandingRow[],
  remaining: Match[],
  focusId: number,
  mode: 'best' | 'worst',
): number {
  const map = new Map(baseStandings.map((s) => [s.teamId, cloneRow(s)]))

  for (const match of remaining) {
    const homeId = match.team1.teamId
    const awayId = match.team2.teamId
    const focusHome = homeId === focusId
    const focusAway = awayId === focusId

    if (focusHome || focusAway) {
      if (mode === 'best') {
        applyOutcome(map, homeId, awayId, focusHome ? 1 : 0, focusAway ? 1 : 0)
      } else {
        applyOutcome(map, homeId, awayId, focusHome ? 0 : 1, focusAway ? 0 : 1)
      }
      continue
    }

    if (mode === 'best') {
      applyOutcome(map, homeId, awayId, 1, 1)
    } else {
      const home = map.get(homeId)!
      const away = map.get(awayId)!
      const focus = map.get(focusId)!
      const homeThreat = home.points >= focus.points - 10
      const awayThreat = away.points >= focus.points - 10
      if (homeThreat && !awayThreat) applyOutcome(map, homeId, awayId, 1, 0)
      else if (awayThreat && !homeThreat) applyOutcome(map, homeId, awayId, 0, 1)
      else if (home.points >= away.points) applyOutcome(map, homeId, awayId, 1, 0)
      else applyOutcome(map, homeId, awayId, 0, 1)
    }
  }

  return rankOf([...map.values()], focusId)
}

export function nextOpenMatchday(remaining: Match[]): number | null {
  if (!remaining.length) return null
  return Math.min(...remaining.map((m) => m.group.groupOrderID))
}

export function matchesOnMatchday(remaining: Match[], matchday: number): Match[] {
  return remaining.filter((m) => m.group.groupOrderID === matchday)
}

/**
 * Exakte Best-/Schlechtfall-Platzierung nach nur dem nächsten Spieltag
 * (alle 1/X/2-Kombinationen der Spiele dieses Spieltags).
 */
export function computeNextMatchdayOutlook(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
): NextMatchdayOutlook | null {
  const matchday = nextOpenMatchday(remaining)
  if (matchday == null) return null

  const fixtures = matchesOnMatchday(remaining, matchday)
  if (!fixtures.length) return null

  const own = fixtures.find(
    (m) => m.team1.teamId === teamId || m.team2.teamId === teamId,
  )
  const plays = Boolean(own)
  const opponentName = own
    ? own.team1.teamId === teamId
      ? own.team2.shortName || own.team2.teamName
      : own.team1.shortName || own.team1.teamName
    : null

  if (fixtures.length > 12) {
    const bestRank = simulateExtreme(baseStandings, fixtures, teamId, 'best')
    const worstRank = simulateExtreme(baseStandings, fixtures, teamId, 'worst')
    return {
      matchday,
      fixtureCount: fixtures.length,
      plays,
      opponentName,
      range: {
        teamId,
        bestRank: Math.min(bestRank, worstRank),
        worstRank: Math.max(bestRank, worstRank),
      },
    }
  }

  let bestRank = baseStandings.length
  let worstRank = 1
  const total = 3 ** fixtures.length

  for (let mask = 0; mask < total; mask++) {
    const map = new Map(baseStandings.map((s) => [s.teamId, cloneRow(s)]))
    let x = mask
    for (const match of fixtures) {
      const outcome = OUTCOMES[x % 3]!
      x = Math.floor(x / 3)
      applyOutcome(
        map,
        match.team1.teamId,
        match.team2.teamId,
        outcome[0],
        outcome[1],
      )
    }
    const rank = rankOf([...map.values()], teamId)
    if (rank < bestRank) bestRank = rank
    if (rank > worstRank) worstRank = rank
  }

  return {
    matchday,
    fixtureCount: fixtures.length,
    plays,
    opponentName,
    range: { teamId, bestRank, worstRank },
  }
}

export function applyScenariosToStandings(
  matches: Match[],
  scenarios: ScenarioResult[],
  maxMatchday: number | null,
): StandingRow[] {
  return buildStandings(matches, { maxMatchday, scenarios })
}

export function scenarioFromOutcome(
  matchId: number,
  outcome: 'home' | 'draw' | 'away',
): ScenarioResult {
  if (outcome === 'home') return { matchId, homeGoals: 1, awayGoals: 0 }
  if (outcome === 'away') return { matchId, homeGoals: 0, awayGoals: 1 }
  return { matchId, homeGoals: 1, awayGoals: 1 }
}

export function getAnalysisMatches(
  matches: Match[],
  asOfMatchday: number | null,
): Match[] {
  return remainingMatches(matches, asOfMatchday)
}
