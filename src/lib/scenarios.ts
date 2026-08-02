import type {
  CaseConditions,
  Match,
  MatchOutcome,
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
import type { PointRankOutcome } from './thresholds'

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

/** Index 0 = Heim-Sieg, 1 = Remis, 2 = Auswärts-Sieg */
const OUTCOMES: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
]

function outcomeFromIndex(i: number): MatchOutcome {
  if (i === 0) return 'home'
  if (i === 1) return 'draw'
  return 'away'
}

function focusResultFromOutcome(
  isHome: boolean,
  outcome: MatchOutcome,
): 'win' | 'draw' | 'loss' {
  if (outcome === 'draw') return 'draw'
  if (outcome === 'home') return isHome ? 'win' : 'loss'
  return isHome ? 'loss' : 'win'
}

function emptyConditions(mode: 'exact' | 'heuristic'): CaseConditions {
  return {
    mode,
    ownMatch: null,
    ownRest: [],
    required: [],
    flexible: [],
    relevantRivals: [],
    totalWays: 0,
  }
}

function teamLabel(row: { shortName: string; teamName: string }): string {
  return row.shortName || row.teamName
}

function matchLabel(m: Match): { homeName: string; awayName: string } {
  return {
    homeName: m.team1.shortName || m.team1.teamName,
    awayName: m.team2.shortName || m.team2.teamName,
  }
}

/**
 * Zerlegt optimale Masken in notwendige vs. flexible Fremdergebnisse.
 *
 * Korrektheit: „required“ heißt „gilt in JEDEM optimalen Weg“ (bei fixer eigener Vorgabe).
 * Keine Aussage über gemeinsame Kombinierbarkeit der flexiblen Spiele.
 */
export function deriveExactCaseConditions(
  fixtures: Match[],
  teamId: number,
  optimalMasks: number[],
  mode: 'best' | 'worst',
): CaseConditions {
  const base = emptyConditions('exact')
  if (!optimalMasks.length || !fixtures.length) return base

  const ownIdx = fixtures.findIndex(
    (m) => m.team1.teamId === teamId || m.team2.teamId === teamId,
  )

  const outcomeAt = (mask: number, fi: number) =>
    Math.floor(mask / 3 ** fi) % 3

  // Eigene Vorgabe: eindeutiger Ausgang, sonst Win (Best) / Loss (Schlecht) wenn möglich
  let ownOutcomeIdx: number | null = null
  if (ownIdx >= 0) {
    const ownSet = new Set(optimalMasks.map((m) => outcomeAt(m, ownIdx)))
    if (ownSet.size === 1) {
      ownOutcomeIdx = [...ownSet][0]!
    } else {
      const own = fixtures[ownIdx]!
      const isHome = own.team1.teamId === teamId
      const preferWin = mode === 'best'
      for (const oi of ownSet) {
        const fr = focusResultFromOutcome(isHome, outcomeFromIndex(oi))
        if (preferWin && fr === 'win') {
          ownOutcomeIdx = oi
          break
        }
        if (!preferWin && fr === 'loss') {
          ownOutcomeIdx = oi
          break
        }
      }
      if (ownOutcomeIdx == null) ownOutcomeIdx = [...ownSet][0]!
    }
  }

  // Masken auf gewählte eigene Vorgabe einschränken
  const filtered =
    ownIdx < 0 || ownOutcomeIdx == null
      ? optimalMasks
      : optimalMasks.filter((m) => outcomeAt(m, ownIdx) === ownOutcomeIdx)

  if (!filtered.length) return base

  if (ownIdx >= 0 && ownOutcomeIdx != null) {
    const own = fixtures[ownIdx]!
    const isHome = own.team1.teamId === teamId
    const outcome = outcomeFromIndex(ownOutcomeIdx)
    base.ownMatch = {
      matchId: own.matchID,
      opponentName: isHome
        ? own.team2.shortName || own.team2.teamName
        : own.team1.shortName || own.team1.teamName,
      opponentIconUrl: isHome ? own.team2.teamIconUrl : own.team1.teamIconUrl,
      homeAway: isHome ? 'H' : 'A',
      outcome,
      focusResult: focusResultFromOutcome(isHome, outcome),
    }
  }

  for (let fi = 0; fi < fixtures.length; fi++) {
    if (fi === ownIdx) continue
    const set = new Set(filtered.map((m) => outcomeAt(m, fi)))
    const match = fixtures[fi]!
    const names = matchLabel(match)
    if (set.size === 1) {
      const oi = [...set][0]!
      base.required.push({
        matchId: match.matchID,
        homeName: names.homeName,
        awayName: names.awayName,
        homeIconUrl: match.team1.teamIconUrl,
        awayIconUrl: match.team2.teamIconUrl,
        outcome: outcomeFromIndex(oi),
      })
    } else {
      base.flexible.push({
        matchId: match.matchID,
        homeName: names.homeName,
        awayName: names.awayName,
        homeIconUrl: match.team1.teamIconUrl,
        awayIconUrl: match.team2.teamIconUrl,
      })
    }
  }

  base.totalWays = filtered.length
  return base
}

/** Punkte-Fenster: Konkurrenten, die den Fokusplatz noch erreichen könnten. */
const RIVAL_POINTS_WINDOW = 12

export function deriveHeuristicSeasonConditions(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  mode: 'best' | 'worst',
): CaseConditions {
  const cond = emptyConditions('heuristic')
  const focus = baseStandings.find((s) => s.teamId === teamId)
  if (!focus) return cond

  const ownMatches = remaining.filter(
    (m) => m.team1.teamId === teamId || m.team2.teamId === teamId,
  )
  const foreign = remaining.filter(
    (m) => m.team1.teamId !== teamId && m.team2.teamId !== teamId,
  )

  for (const m of ownMatches) {
    const isHome = m.team1.teamId === teamId
    const opponent = isHome ? m.team2 : m.team1
    const focusResult = mode === 'best' ? 'win' : 'loss'
    const outcome: MatchOutcome = isHome
      ? focusResult === 'win'
        ? 'home'
        : 'away'
      : focusResult === 'win'
        ? 'away'
        : 'home'
    cond.ownRest.push({
      matchId: m.matchID,
      opponentName: opponent.shortName || opponent.teamName,
      opponentIconUrl: opponent.teamIconUrl,
      homeAway: isHome ? 'H' : 'A',
      focusResult,
      outcome,
    })
  }

  // Erste eigene Partie auch als ownMatch für einheitliche UI
  if (cond.ownRest[0]) {
    const first = cond.ownRest[0]
    cond.ownMatch = {
      matchId: first.matchId,
      opponentName: first.opponentName,
      opponentIconUrl: first.opponentIconUrl,
      homeAway: first.homeAway,
      outcome: first.outcome,
      focusResult: first.focusResult,
    }
  }

  const rivals = baseStandings.filter((s) => {
    if (s.teamId === teamId) return false
    if (mode === 'best') {
      // Teams in/über der Zielzone bzw. nah am Fokus
      return s.points >= focus.points - RIVAL_POINTS_WINDOW
    }
    // Schlechtfall: Teams die den Fokus noch überholen können
    return s.points + RIVAL_POINTS_WINDOW >= focus.points
  })
  cond.relevantRivals = rivals.map((s) => ({
    teamId: s.teamId,
    teamName: teamLabel(s),
    teamIconUrl: s.teamIconUrl,
    points: s.points,
    rank: s.rank,
  }))

  const rivalIds = new Set(rivals.map((r) => r.teamId))
  for (const m of foreign) {
    const names = matchLabel(m)
    const involvesRival =
      rivalIds.has(m.team1.teamId) || rivalIds.has(m.team2.teamId)
    if (!involvesRival) {
      cond.flexible.push({
        matchId: m.matchID,
        homeName: names.homeName,
        awayName: names.awayName,
        homeIconUrl: m.team1.teamIconUrl,
        awayIconUrl: m.team2.teamIconUrl,
      })
    }
  }

  return cond
}

/** Szenarien aus exakten Bedingungen (eigen + required); flexible bleiben offen. */
export function scenariosFromConditions(cond: CaseConditions): ScenarioResult[] {
  const out: ScenarioResult[] = []
  const pushOutcome = (matchId: number, outcome: MatchOutcome) => {
    out.push(scenarioFromOutcome(matchId, outcome))
  }
  if (cond.mode === 'exact' && cond.ownMatch) {
    pushOutcome(cond.ownMatch.matchId, cond.ownMatch.outcome)
  }
  if (cond.mode === 'heuristic') {
    for (const own of cond.ownRest) {
      pushOutcome(own.matchId, own.outcome)
    }
  }
  for (const req of cond.required) {
    pushOutcome(req.matchId, req.outcome)
  }
  return out
}

/** Heuristische Extreme über Restspiele. */
function simulateExtremeFinish(
  baseStandings: StandingRow[],
  remaining: Match[],
  focusId: number,
  mode: 'best' | 'worst',
  priorScores: MatchScore[] = [],
): PointRankOutcome {
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

  const row = map.get(focusId)!
  return {
    points: row.points,
    rank: rankOf([...map.values()], focusId, scores),
  }
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
    return {
      range: { teamId, bestRank: row.rank, worstRank: row.rank },
      bestConditions: null,
      worstConditions: null,
    }
  }

  const best = simulateExtremeFinish(
    baseStandings,
    remaining,
    teamId,
    'best',
    priorScores,
  )
  const worst = simulateExtremeFinish(
    baseStandings,
    remaining,
    teamId,
    'worst',
    priorScores,
  )
  return {
    range: {
      teamId,
      bestRank: Math.min(best.rank, worst.rank),
      worstRank: Math.max(best.rank, worst.rank),
    },
    bestConditions: deriveHeuristicSeasonConditions(
      baseStandings,
      remaining,
      teamId,
      'best',
    ),
    worstConditions: deriveHeuristicSeasonConditions(
      baseStandings,
      remaining,
      teamId,
      'worst',
    ),
  }
}

/** Spannen für alle Teams (Tabellenspalte „Möglich“). */
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
  const isHome = own ? own.team1.teamId === teamId : false
  const opponent = own
    ? isHome
      ? own.team2
      : own.team1
    : null
  const opponentName = opponent
    ? opponent.shortName || opponent.teamName
    : null
  const opponentIconUrl = opponent?.teamIconUrl ?? null
  const homeAway: 'H' | 'A' | null = own ? (isHome ? 'H' : 'A') : null

  if (fixtures.length > 12) {
    const best = simulateExtremeFinish(
      baseStandings,
      fixtures,
      teamId,
      'best',
      priorScores,
    )
    const worst = simulateExtremeFinish(
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
      opponentIconUrl,
      homeAway,
      range: {
        teamId,
        bestRank: Math.min(best.rank, worst.rank),
        worstRank: Math.max(best.rank, worst.rank),
      },
      bestConditions: null,
      worstConditions: null,
    }
  }

  let bestRank = baseStandings.length
  let worstRank = 1
  const total = 3 ** fixtures.length
  const ranksByMask: number[] = new Array(total)

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
    ranksByMask[mask] = rank
    if (rank < bestRank) bestRank = rank
    if (rank > worstRank) worstRank = rank
  }

  const bestMasks: number[] = []
  const worstMasks: number[] = []
  for (let mask = 0; mask < total; mask++) {
    if (ranksByMask[mask] === bestRank) bestMasks.push(mask)
    if (ranksByMask[mask] === worstRank) worstMasks.push(mask)
  }

  return {
    matchday,
    fixtureCount: fixtures.length,
    plays,
    opponentName,
    opponentIconUrl,
    homeAway,
    range: { teamId, bestRank, worstRank },
    bestConditions: deriveExactCaseConditions(fixtures, teamId, bestMasks, 'best'),
    worstConditions: deriveExactCaseConditions(
      fixtures,
      teamId,
      worstMasks,
      'worst',
    ),
  }
}

/** Alle (Punkte, Rang)-Paare des Fokusvereins nach Enumeration des Spieltags. */
export function enumerateMatchdayOutcomes(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  priorScores: MatchScore[] = [],
): PointRankOutcome[] | null {
  const matchday = nextOpenMatchday(remaining)
  if (matchday == null) return null
  const fixtures = matchesOnMatchday(remaining, matchday)
  if (!fixtures.length) return null

  if (fixtures.length > 12) {
    const best = simulateExtremeFinish(
      baseStandings,
      fixtures,
      teamId,
      'best',
      priorScores,
    )
    const worst = simulateExtremeFinish(
      baseStandings,
      fixtures,
      teamId,
      'worst',
      priorScores,
    )
    return [best, worst]
  }

  const out: PointRankOutcome[] = []
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
    const row = map.get(teamId)!
    out.push({
      points: row.points,
      rank: rankOf([...map.values()], teamId, scores),
    })
  }
  return out
}

/** Heuristische Best-/Schlechtfall-Outcomes für die Saison (Näherung). */
export function seasonExtremeOutcomes(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  priorScores: MatchScore[] = [],
): PointRankOutcome[] | null {
  if (!remaining.length) {
    const row = baseStandings.find((s) => s.teamId === teamId)
    if (!row) return null
    return [{ points: row.points, rank: row.rank }]
  }
  return [
    simulateExtremeFinish(baseStandings, remaining, teamId, 'best', priorScores),
    simulateExtremeFinish(baseStandings, remaining, teamId, 'worst', priorScores),
  ]
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
