import type {
  Match,
  NextMatchdayOutlook,
  PathwayStep,
  PositionRange,
  ScenarioPathway,
  ScenarioResult,
  SeasonOutlook,
  StandingRow,
} from '../types'
import { buildStandings, compareStandings, remainingMatches } from './table'

function cloneRow(row: StandingRow): StandingRow {
  return { ...row }
}

function tipFor(homeGoals: number, awayGoals: number): '1' | 'X' | '2' {
  if (homeGoals > awayGoals) return '1'
  if (homeGoals < awayGoals) return '2'
  return 'X'
}

function stepFrom(
  match: Match,
  homeGoals: number,
  awayGoals: number,
  focusId: number,
): PathwayStep {
  return {
    matchId: match.matchID,
    homeName: match.team1.shortName || match.team1.teamName,
    awayName: match.team2.shortName || match.team2.teamName,
    homeGoals,
    awayGoals,
    tip: tipFor(homeGoals, awayGoals),
    involvesFocus:
      match.team1.teamId === focusId || match.team2.teamId === focusId,
  }
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

function simulateExtremeWithPath(
  baseStandings: StandingRow[],
  remaining: Match[],
  focusId: number,
  mode: 'best' | 'worst',
): ScenarioPathway {
  const map = new Map(baseStandings.map((s) => [s.teamId, cloneRow(s)]))
  const steps: PathwayStep[] = []

  for (const match of remaining) {
    const homeId = match.team1.teamId
    const awayId = match.team2.teamId
    const focusHome = homeId === focusId
    const focusAway = awayId === focusId
    let homeGoals = 0
    let awayGoals = 0

    if (focusHome || focusAway) {
      if (mode === 'best') {
        homeGoals = focusHome ? 1 : 0
        awayGoals = focusAway ? 1 : 0
      } else {
        homeGoals = focusHome ? 0 : 1
        awayGoals = focusAway ? 0 : 1
      }
    } else if (mode === 'best') {
      homeGoals = 1
      awayGoals = 1
    } else {
      const home = map.get(homeId)!
      const away = map.get(awayId)!
      const focus = map.get(focusId)!
      const homeThreat = home.points >= focus.points - 10
      const awayThreat = away.points >= focus.points - 10
      if (homeThreat && !awayThreat) {
        homeGoals = 1
        awayGoals = 0
      } else if (awayThreat && !homeThreat) {
        homeGoals = 0
        awayGoals = 1
      } else if (home.points >= away.points) {
        homeGoals = 1
        awayGoals = 0
      } else {
        homeGoals = 0
        awayGoals = 1
      }
    }

    applyOutcome(map, homeId, awayId, homeGoals, awayGoals)
    steps.push(stepFrom(match, homeGoals, awayGoals, focusId))
  }

  return { rank: rankOf([...map.values()], focusId), steps, ways: null }
}

/**
 * Saison-Rest: Best-/Schlechtfall heuristisch + Pathways.
 */
export function computeSeasonOutlook(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
): SeasonOutlook | null {
  if (!remaining.length) {
    const row = baseStandings.find((s) => s.teamId === teamId)
    if (!row) return null
    return {
      range: { teamId, bestRank: row.rank, worstRank: row.rank },
      bestPathway: { rank: row.rank, steps: [], ways: null },
      worstPathway: { rank: row.rank, steps: [], ways: null },
    }
  }

  const best = simulateExtremeWithPath(baseStandings, remaining, teamId, 'best')
  const worst = simulateExtremeWithPath(baseStandings, remaining, teamId, 'worst')
  return {
    range: {
      teamId,
      bestRank: Math.min(best.rank, worst.rank),
      worstRank: Math.max(best.rank, worst.rank),
    },
    bestPathway: best.rank <= worst.rank ? best : worst,
    worstPathway: best.rank >= worst.rank ? best : worst,
  }
}

/** @deprecated use computeSeasonOutlook for selected team */
export function computePositionRanges(
  baseStandings: StandingRow[],
  remaining: Match[],
): PositionRange[] {
  return baseStandings.map((team) => {
    const outlook = computeSeasonOutlook(baseStandings, remaining, team.teamId)
    return (
      outlook?.range ?? {
        teamId: team.teamId,
        bestRank: team.rank,
        worstRank: team.rank,
      }
    )
  })
}

export function nextOpenMatchday(remaining: Match[]): number | null {
  if (!remaining.length) return null
  return Math.min(...remaining.map((m) => m.group.groupOrderID))
}

export function matchesOnMatchday(remaining: Match[], matchday: number): Match[] {
  return remaining.filter((m) => m.group.groupOrderID === matchday)
}

function pathwayFromMask(
  fixtures: Match[],
  mask: number,
  focusId: number,
): PathwayStep[] {
  const steps: PathwayStep[] = []
  let x = mask
  for (const match of fixtures) {
    const outcome = OUTCOMES[x % 3]!
    x = Math.floor(x / 3)
    steps.push(stepFrom(match, outcome[0], outcome[1], focusId))
  }
  return steps
}

/**
 * Exakte Best-/Schlechtfall-Platzierung nach dem nächsten Spieltag + Pathways.
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
    const best = simulateExtremeWithPath(baseStandings, fixtures, teamId, 'best')
    const worst = simulateExtremeWithPath(baseStandings, fixtures, teamId, 'worst')
    const totalConstellations = 3 ** fixtures.length
    return {
      matchday,
      fixtureCount: fixtures.length,
      totalConstellations,
      plays,
      opponentName,
      range: {
        teamId,
        bestRank: Math.min(best.rank, worst.rank),
        worstRank: Math.max(best.rank, worst.rank),
      },
      bestPathway: best.rank <= worst.rank ? best : worst,
      worstPathway: best.rank >= worst.rank ? best : worst,
    }
  }

  let bestRank = baseStandings.length
  let worstRank = 1
  let bestMask = 0
  let worstMask = 0
  let bestWays = 0
  let worstWays = 0
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
    if (rank < bestRank) {
      bestRank = rank
      bestMask = mask
      bestWays = 1
    } else if (rank === bestRank) {
      bestWays += 1
    }
    if (rank > worstRank) {
      worstRank = rank
      worstMask = mask
      worstWays = 1
    } else if (rank === worstRank) {
      worstWays += 1
    }
  }

  return {
    matchday,
    fixtureCount: fixtures.length,
    totalConstellations: total,
    plays,
    opponentName,
    range: { teamId, bestRank, worstRank },
    bestPathway: {
      rank: bestRank,
      steps: pathwayFromMask(fixtures, bestMask, teamId),
      ways: bestWays,
    },
    worstPathway: {
      rank: worstRank,
      steps: pathwayFromMask(fixtures, worstMask, teamId),
      ways: worstWays,
    },
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
  return { matchId, homeGoals: 0, awayGoals: 0 }
}

export function scenarioFromScore(
  matchId: number,
  homeGoals: number,
  awayGoals: number,
): ScenarioResult {
  return {
    matchId,
    homeGoals: Math.max(0, Math.min(99, Math.floor(homeGoals))),
    awayGoals: Math.max(0, Math.min(99, Math.floor(awayGoals))),
  }
}

export function getAnalysisMatches(
  matches: Match[],
  asOfMatchday: number | null,
): Match[] {
  return remainingMatches(matches, asOfMatchday)
}
