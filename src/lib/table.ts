import type { Match, MatchResult, ScenarioResult, StandingRow } from '../types'

export function finalResult(match: Match): MatchResult | null {
  if (!match.matchResults?.length) return null
  const end = match.matchResults.find((r) => r.resultTypeID === 2)
  if (end) return end
  return [...match.matchResults].sort((a, b) => b.resultOrderID - a.resultOrderID)[0] ?? null
}

function emptyStanding(
  teamId: number,
  teamName: string,
  shortName: string,
  teamIconUrl: string,
): Omit<StandingRow, 'rank'> {
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

function applyScore(
  map: Map<number, Omit<StandingRow, 'rank'>>,
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

export function compareStandings(
  a: Omit<StandingRow, 'rank'>,
  b: Omit<StandingRow, 'rank'>,
): number {
  if (b.points !== a.points) return b.points - a.points
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
  return a.teamName.localeCompare(b.teamName, 'de')
}

export function rankStandings(rows: Omit<StandingRow, 'rank'>[]): StandingRow[] {
  const sorted = [...rows].sort(compareStandings)
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }))
}

/** Build table from matches up to (and including) maxMatchday. If null, use finished matches. */
export function buildStandings(
  matches: Match[],
  options: {
    maxMatchday?: number | null
    scenarios?: ScenarioResult[]
  } = {},
): StandingRow[] {
  const { maxMatchday = null, scenarios = [] } = options
  const scenarioMap = new Map(scenarios.map((s) => [s.matchId, s]))
  const map = new Map<number, Omit<StandingRow, 'rank'>>()

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

  for (const match of matches) {
    const matchday = match.group.groupOrderID
    if (maxMatchday != null && matchday > maxMatchday) continue

    const scenario = scenarioMap.get(match.matchID)
    if (scenario) {
      applyScore(
        map,
        match.team1.teamId,
        match.team2.teamId,
        scenario.homeGoals,
        scenario.awayGoals,
      )
      continue
    }

    const includeFinished =
      maxMatchday != null ? matchday <= maxMatchday && match.matchIsFinished : match.matchIsFinished

    if (!includeFinished) continue

    const result = finalResult(match)
    if (!result) continue

    applyScore(
      map,
      match.team1.teamId,
      match.team2.teamId,
      result.pointsTeam1,
      result.pointsTeam2,
    )
  }

  return rankStandings([...map.values()])
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

export function zoneForRank(rank: number, leagueSize: number): string {
  if (rank === 1) return 'champion'
  if (rank <= 4) return 'cl'
  if (rank === 5) return 'el'
  if (rank === 6) return 'ecl'
  if (leagueSize >= 18) {
    if (rank === leagueSize - 2) return 'relegation'
    if (rank >= leagueSize - 1) return 'direct-relegation'
  }
  return 'mid'
}
