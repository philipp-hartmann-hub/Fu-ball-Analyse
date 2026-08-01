import type { Match, PositionRange, ScenarioResult, StandingRow } from '../types'
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

/**
 * Approximate best/worst final ranks for each team.
 * Focus team: wins/loses all remaining games.
 * Other matches: outcomes chosen to help (best) or hurt (worst) the focus team
 * via simple points heuristics (not full combinatorial search).
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

    // Other fixtures: hurt rivals when seeking best rank for focus,
    // help rivals when seeking worst rank.
    if (mode === 'best') {
      applyOutcome(map, homeId, awayId, 1, 1) // draw: minimize points distributed
    } else {
      // Give 3 points to whoever is closer to catching the focus team
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
