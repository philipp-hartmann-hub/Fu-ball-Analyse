import type {
  Match,
  NextMatchdayOutlook,
  PositionRange,
  ScenarioResult,
  SeasonOutlook,
  StandingRow,
} from '../types'
import {
  buildStandings,
  rankStandings,
  remainingMatches,
  type MatchScore,
} from './table'

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

function toDrafts(standings: StandingRow[]) {
  return standings.map((row) => ({
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
  }))
}

function rankOf(
  standings: StandingRow[],
  teamId: number,
  matchScores: MatchScore[] = [],
): number {
  const ranked = rankStandings(toDrafts(standings), { matchScores })
  return ranked.findIndex((s) => s.teamId === teamId) + 1
}

const OUTCOMES: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
]

/** Heuristische Extreme über Restspiele (nur Rang). */
function simulateExtremeRank(
  baseStandings: StandingRow[],
  remaining: Match[],
  focusId: number,
  mode: 'best' | 'worst',
  priorScores: MatchScore[] = [],
): number {
  const map = new Map(baseStandings.map((s) => [s.teamId, cloneRow(s)]))
  const scores: MatchScore[] = [...priorScores]

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
    scores.push({
      matchId: match.matchID,
      homeId,
      awayId,
      homeGoals,
      awayGoals,
    })
  }

  return rankOf([...map.values()], focusId, scores)
}

export function computeSeasonOutlook(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  priorScores: MatchScore[] = [],
): SeasonOutlook | null {
  if (!remaining.length) {
    const row = baseStandings.find((s) => s.teamId === teamId)
    if (!row) return null
    return { range: { teamId, bestRank: row.rank, worstRank: row.rank } }
  }

  const best = simulateExtremeRank(
    baseStandings,
    remaining,
    teamId,
    'best',
    priorScores,
  )
  const worst = simulateExtremeRank(
    baseStandings,
    remaining,
    teamId,
    'worst',
    priorScores,
  )
  return {
    range: {
      teamId,
      bestRank: Math.min(best, worst),
      worstRank: Math.max(best, worst),
    },
  }
}

/** @deprecated use computeSeasonOutlook for selected team */
export function computePositionRanges(
  baseStandings: StandingRow[],
  remaining: Match[],
  priorScores: MatchScore[] = [],
): PositionRange[] {
  return baseStandings.map((team) => {
    const outlook = computeSeasonOutlook(
      baseStandings,
      remaining,
      team.teamId,
      priorScores,
    )
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

/** Exakte Best-/Schlechtfall-Platzierung nach dem nächsten Spieltag. */
export function computeNextMatchdayOutlook(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  priorScores: MatchScore[] = [],
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
    const best = simulateExtremeRank(
      baseStandings,
      fixtures,
      teamId,
      'best',
      priorScores,
    )
    const worst = simulateExtremeRank(
      baseStandings,
      fixtures,
      teamId,
      'worst',
      priorScores,
    )
    return {
      matchday,
      fixtureCount: fixtures.length,
      plays,
      opponentName,
      range: {
        teamId,
        bestRank: Math.min(best, worst),
        worstRank: Math.max(best, worst),
      },
    }
  }

  let bestRank = baseStandings.length
  let worstRank = 1
  const total = 3 ** fixtures.length

  for (let mask = 0; mask < total; mask++) {
    const map = new Map(baseStandings.map((s) => [s.teamId, cloneRow(s)]))
    const scores: MatchScore[] = [...priorScores]
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
      scores.push({
        matchId: match.matchID,
        homeId: match.team1.teamId,
        awayId: match.team2.teamId,
        homeGoals: outcome[0],
        awayGoals: outcome[1],
      })
    }
    const rank = rankOf([...map.values()], teamId, scores)
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
