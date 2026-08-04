import type {
  CaseConditions,
  Match,
  MatchOutcome,
  NextMatchdayOutlook,
  PositionRange,
  ScenarioResult,
  SeasonOutlook,
  StandingRow,
  TargetComparator,
  TargetOutlook,
  TargetOwnOption,
} from '../types'
import {
  buildStandings,
  rankStandings,
  remainingMatches,
  applyScore,
  type MatchScore,
  type StandingDraft,
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
    partiallyConstrained: [],
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

/** Aufwand der eigenen Vorgabe: Remis < Sieg < Niederlage. */
function ownEffort(focusResult: 'win' | 'draw' | 'loss'): number {
  if (focusResult === 'draw') return 0
  if (focusResult === 'win') return 1
  return 2
}

function focusResultLabelShort(fr: 'win' | 'draw' | 'loss'): string {
  if (fr === 'win') return 'Sieg'
  if (fr === 'draw') return 'Remis'
  return 'Niederlage'
}

/**
 * Zerlegt Masken in notwendige / teilweise eingeschränkte / flexible Fremdergebnisse.
 *
 * Pro Fremdspiel Menge S der Ausgänge in den gefilterten optimalen Masken:
 * - |S|==1 → required
 * - |S|==2 → partiallyConstrained (fehlendes Element = forbiddenOutcome)
 * - |S|==3 → flexible („wirklich egal“)
 *
 * mode:
 * - best/worst: bei mehreren eigenen Outcomes Win bzw. Loss bevorzugen
 * - target: geringsten eigenen Aufwand (Remis vor Sieg vor Niederlage)
 */
export function deriveExactCaseConditions(
  fixtures: Match[],
  teamId: number,
  optimalMasks: number[],
  mode: 'best' | 'worst' | 'target',
): CaseConditions {
  const base = emptyConditions('exact')
  if (!optimalMasks.length || !fixtures.length) return base

  const ownIdx = fixtures.findIndex(
    (m) => m.team1.teamId === teamId || m.team2.teamId === teamId,
  )

  const outcomeAt = (mask: number, fi: number) =>
    Math.floor(mask / 3 ** fi) % 3

  let ownOutcomeIdx: number | null = null
  if (ownIdx >= 0) {
    const ownSet = new Set(optimalMasks.map((m) => outcomeAt(m, ownIdx)))
    if (ownSet.size === 1) {
      ownOutcomeIdx = [...ownSet][0]!
    } else {
      const own = fixtures[ownIdx]!
      const isHome = own.team1.teamId === teamId
      if (mode === 'target') {
        let bestEffort = Infinity
        for (const oi of ownSet) {
          const fr = focusResultFromOutcome(isHome, outcomeFromIndex(oi))
          const e = ownEffort(fr)
          if (e < bestEffort) {
            bestEffort = e
            ownOutcomeIdx = oi
          }
        }
      } else {
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
      }
      if (ownOutcomeIdx == null) ownOutcomeIdx = [...ownSet][0]!
    }
  }

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

  const ALL_OUTCOMES: MatchOutcome[] = ['home', 'draw', 'away']

  for (let fi = 0; fi < fixtures.length; fi++) {
    if (fi === ownIdx) continue
    const set = new Set(filtered.map((m) => outcomeAt(m, fi)))
    const match = fixtures[fi]!
    const names = matchLabel(match)
    const meta = {
      matchId: match.matchID,
      homeName: names.homeName,
      awayName: names.awayName,
      homeIconUrl: match.team1.teamIconUrl,
      awayIconUrl: match.team2.teamIconUrl,
    }
    if (set.size === 1) {
      const oi = [...set][0]!
      base.required.push({
        ...meta,
        outcome: outcomeFromIndex(oi),
      })
    } else if (set.size === 2) {
      const allowed = [...set]
        .sort((a, b) => a - b)
        .map((oi) => outcomeFromIndex(oi))
      const forbiddenOutcome = ALL_OUTCOMES.find((o) => !allowed.includes(o))!
      base.partiallyConstrained.push({
        ...meta,
        allowedOutcomes: allowed,
        forbiddenOutcome,
      })
    } else {
      base.flexible.push(meta)
    }
  }

  base.totalWays = filtered.length
  return base
}

/** Alle eigenen Ausgänge in den Masken, die das Ziel erreichen (für ownOptions). */
export function collectOwnTargetOptions(
  fixtures: Match[],
  teamId: number,
  targetMasks: number[],
  defaultFocus: 'win' | 'draw' | 'loss' | null,
): TargetOwnOption[] {
  const ownIdx = fixtures.findIndex(
    (m) => m.team1.teamId === teamId || m.team2.teamId === teamId,
  )
  if (ownIdx < 0 || !targetMasks.length) return []
  const own = fixtures[ownIdx]!
  const isHome = own.team1.teamId === teamId
  const outcomeAt = (mask: number) => Math.floor(mask / 3 ** ownIdx) % 3
  const byFocus = new Map<'win' | 'draw' | 'loss', MatchOutcome>()
  for (const mask of targetMasks) {
    const oi = outcomeAt(mask)
    const outcome = outcomeFromIndex(oi)
    const fr = focusResultFromOutcome(isHome, outcome)
    if (!byFocus.has(fr)) byFocus.set(fr, outcome)
  }
  const opts: TargetOwnOption[] = []
  for (const fr of ['draw', 'win', 'loss'] as const) {
    const outcome = byFocus.get(fr)
    if (outcome == null) continue
    if (defaultFocus != null && fr === defaultFocus) continue
    opts.push({
      focusResult: fr,
      outcome,
      label: `Ziel auch mit ${focusResultLabelShort(fr)} erreichbar`,
    })
  }
  return opts
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

/**
 * Max. relevante Restspiele je Punkte-Komponente für exakte 3^n-Enumeration.
 * Ein Durchlauf pro Komponente — widerspruchsfreie Ranges innerhalb des Bandes.
 */
export const EXACT_LIMIT = 12
/** @deprecated Alias für EXACT_LIMIT */
export const EXACT_SEASON_LIMIT = EXACT_LIMIT

/** Restspiele je Team (Auftritte in `remaining`). */
export function countRemainingAppearances(remaining: Match[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const m of remaining) {
    counts.set(m.team1.teamId, (counts.get(m.team1.teamId) ?? 0) + 1)
    counts.set(m.team2.teamId, (counts.get(m.team2.teamId) ?? 0) + 1)
  }
  return counts
}

/** Erreichbares Punkteintervall [min, max] je Team (0 bzw. 3 Punkte je Restspiel). */
export function teamPointBounds(
  standings: StandingRow[],
  remaining: Match[],
): Map<number, { min: number; max: number }> {
  const games = countRemainingAppearances(remaining)
  const bounds = new Map<number, { min: number; max: number }>()
  for (const row of standings) {
    const g = games.get(row.teamId) ?? 0
    bounds.set(row.teamId, { min: row.points, max: row.points + 3 * g })
  }
  return bounds
}

function pointIntervalsOverlap(
  a: { min: number; max: number },
  b: { min: number; max: number },
): boolean {
  return a.max >= b.min && b.max >= a.min
}

/**
 * Zusammenhängende Komponenten: Teams, die sich über überlappende Punkte-Intervalle
 * (transitiv) noch erreichen können.
 */
export function relevantPointComponents(
  standings: StandingRow[],
  remaining: Match[],
): number[][] {
  const bounds = teamPointBounds(standings, remaining)
  const ids = standings.map((s) => s.teamId)
  const parent = new Map<number, number>()
  for (const id of ids) parent.set(id, id)

  function find(x: number): number {
    let p = parent.get(x)!
    if (p !== x) {
      p = find(p)
      parent.set(x, p)
    }
    return p
  }
  function union(a: number, b: number) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]!
      const b = ids[j]!
      if (pointIntervalsOverlap(bounds.get(a)!, bounds.get(b)!)) union(a, b)
    }
  }

  const groups = new Map<number, number[]>()
  for (const id of ids) {
    const root = find(id)
    const list = groups.get(root) ?? []
    list.push(id)
    groups.set(root, list)
  }
  return [...groups.values()]
}

/**
 * Teams, die einander punktemäßig noch erreichen können (überlappende Intervalle).
 */
export function selectRelevantTeamIds(
  standings: StandingRow[],
  remaining: Match[],
): Set<number> {
  const relevant = new Set<number>()
  for (const comp of relevantPointComponents(standings, remaining)) {
    if (comp.length < 2) continue
    for (const id of comp) relevant.add(id)
  }
  return relevant
}

/** Spiele, die mindestens ein Team aus `teamIds` betreffen. */
export function matchesTouchingTeams(
  remaining: Match[],
  teamIds: ReadonlySet<number>,
): Match[] {
  if (teamIds.size === 0) return []
  return remaining.filter(
    (m) => teamIds.has(m.team1.teamId) || teamIds.has(m.team2.teamId),
  )
}

/**
 * Restspiele des relevanten Bandes (Union über Komponenten mit ≥2 Teams).
 */
export function selectRelevantMatches(
  standings: StandingRow[],
  remaining: Match[],
): Match[] {
  const relevant = selectRelevantTeamIds(standings, remaining)
  return matchesTouchingTeams(remaining, relevant)
}

/**
 * Exact möglich, wenn jede Punkte-Komponente höchstens EXACT_LIMIT Restspiele hat.
 * (Große Bänder blockieren nicht kleinere — pro Komponente enumeriert.)
 */
export function canEnumerateExact(
  standings: StandingRow[],
  remaining: Match[],
): boolean {
  if (!remaining.length) return false
  for (const comp of relevantPointComponents(standings, remaining)) {
    const matches = matchesTouchingTeams(remaining, new Set(comp))
    if (matches.length > EXACT_LIMIT) return false
  }
  return true
}

/** @deprecated Nutze canEnumerateExact(standings, remaining). */
export function canEnumerateSeasonExact(remainingCount: number): boolean {
  return remainingCount > 0 && remainingCount <= EXACT_LIMIT
}

function cloneDraftsMap(standings: StandingRow[]): Map<number, StandingDraft> {
  return new Map(toDrafts(standings).map((d) => [d.teamId, { ...d }]))
}

function fixedPositionRanges(standings: StandingRow[]): PositionRange[] {
  return standings.map((row) => ({
    teamId: row.teamId,
    bestRank: row.rank,
    worstRank: row.rank,
  }))
}

/** Enumeriert eine Match-Liste; aktualisiert best/worst nur für `updateTeamIds`. */
function accumulateRangesFromMasks(
  baseStandings: StandingRow[],
  matches: Match[],
  priorScores: MatchScore[],
  bestByTeam: Map<number, number>,
  worstByTeam: Map<number, number>,
  updateTeamIds: ReadonlySet<number>,
) {
  const total = 3 ** matches.length
  for (let mask = 0; mask < total; mask++) {
    const map = cloneDraftsMap(baseStandings)
    const scores: MatchScore[] = [...priorScores]
    let x = mask
    for (const match of matches) {
      const outcome = OUTCOMES[x % 3]!
      x = Math.floor(x / 3)
      applyScore(
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
    const table = rankStandings([...map.values()], { matchScores: scores })
    for (const row of table) {
      if (!updateTeamIds.has(row.teamId)) continue
      const prevBest = bestByTeam.get(row.teamId)!
      const prevWorst = worstByTeam.get(row.teamId)!
      if (row.rank < prevBest) bestByTeam.set(row.teamId, row.rank)
      if (row.rank > prevWorst) worstByTeam.set(row.teamId, row.rank)
    }
  }
}

/**
 * Exakte Best-/Schlechtfall-Ranges: relevante Komponenten je einmal enumerieren
 * (applyScore + rankStandings), min/max-Rang je Team — widerspruchsfrei.
 */
export function computeExactPositionRanges(
  baseStandings: StandingRow[],
  remaining: Match[],
  priorScores: MatchScore[] = [],
): PositionRange[] | null {
  if (!remaining.length) return fixedPositionRanges(baseStandings)
  if (!canEnumerateExact(baseStandings, remaining)) return null

  const nTeams = baseStandings.length
  const bestByTeam = new Map<number, number>()
  const worstByTeam = new Map<number, number>()
  for (const row of baseStandings) {
    bestByTeam.set(row.teamId, nTeams)
    worstByTeam.set(row.teamId, 1)
  }

  const components = relevantPointComponents(baseStandings, remaining)
  let enumeratedAny = false
  for (const comp of components) {
    const matches = matchesTouchingTeams(remaining, new Set(comp))
    if (matches.length === 0) {
      for (const id of comp) {
        const row = baseStandings.find((s) => s.teamId === id)!
        bestByTeam.set(id, row.rank)
        worstByTeam.set(id, row.rank)
      }
      continue
    }
    enumeratedAny = true
    accumulateRangesFromMasks(
      baseStandings,
      matches,
      priorScores,
      bestByTeam,
      worstByTeam,
      new Set(comp),
    )
  }

  if (!enumeratedAny) return fixedPositionRanges(baseStandings)

  return baseStandings.map((row) => ({
    teamId: row.teamId,
    bestRank: bestByTeam.get(row.teamId)!,
    worstRank: worstByTeam.get(row.teamId)!,
  }))
}

/** Rang je Maske für ein Fokus-Team (für Exact-Conditions; Komponente des Teams). */
function enumerateSeasonRanksByMaskForTeam(
  baseStandings: StandingRow[],
  relevantMatches: Match[],
  teamId: number,
  priorScores: MatchScore[] = [],
): { ranksByMask: number[]; pointsByMask: number[] } | null {
  if (!relevantMatches.length || relevantMatches.length > EXACT_LIMIT) return null

  const total = 3 ** relevantMatches.length
  const ranksByMask = new Array<number>(total)
  const pointsByMask = new Array<number>(total)

  for (let mask = 0; mask < total; mask++) {
    const map = cloneDraftsMap(baseStandings)
    const scores: MatchScore[] = [...priorScores]
    let x = mask
    for (const match of relevantMatches) {
      const outcome = OUTCOMES[x % 3]!
      x = Math.floor(x / 3)
      applyScore(
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
    const table = rankStandings([...map.values()], { matchScores: scores })
    ranksByMask[mask] = table.find((r) => r.teamId === teamId)!.rank
    pointsByMask[mask] = row.points
  }

  return { ranksByMask, pointsByMask }
}

function relevantMatchesForTeam(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
): Match[] {
  const comp =
    relevantPointComponents(baseStandings, remaining).find((c) =>
      c.includes(teamId),
    ) ?? [teamId]
  return matchesTouchingTeams(remaining, new Set(comp))
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

  const relevantMatches = relevantMatchesForTeam(
    baseStandings,
    remaining,
    teamId,
  )
  if (relevantMatches.length <= EXACT_LIMIT) {
    if (relevantMatches.length === 0) {
      const row = baseStandings.find((s) => s.teamId === teamId)
      if (!row) return null
      return {
        range: { teamId, bestRank: row.rank, worstRank: row.rank },
        bestConditions: null,
        worstConditions: null,
      }
    }
    const enumerated = enumerateSeasonRanksByMaskForTeam(
      baseStandings,
      relevantMatches,
      teamId,
      priorScores,
    )
    if (!enumerated) return null
    const { ranksByMask } = enumerated
    let bestRank = baseStandings.length
    let worstRank = 1
    for (const rank of ranksByMask) {
      if (rank < bestRank) bestRank = rank
      if (rank > worstRank) worstRank = rank
    }
    const bestMasks: number[] = []
    const worstMasks: number[] = []
    for (let mask = 0; mask < ranksByMask.length; mask++) {
      if (ranksByMask[mask] === bestRank) bestMasks.push(mask)
      if (ranksByMask[mask] === worstRank) worstMasks.push(mask)
    }
    return {
      range: { teamId, bestRank, worstRank },
      bestConditions: deriveExactCaseConditions(
        relevantMatches,
        teamId,
        bestMasks,
        'best',
      ),
      worstConditions: deriveExactCaseConditions(
        relevantMatches,
        teamId,
        worstMasks,
        'worst',
      ),
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
  const exact = computeExactPositionRanges(
    baseStandings,
    remaining,
    priorScores,
  )
  if (exact) return exact

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

function matchesTargetRank(
  rank: number,
  target: number,
  comparator: TargetComparator,
): boolean {
  return comparator === 'exact' ? rank === target : rank <= target
}

/** Exhaustive 3^n-Enumeration: Rang je Maske. null wenn zu viele Spiele. */
export function enumerateMatchdayRanksByMask(
  baseStandings: StandingRow[],
  fixtures: Match[],
  teamId: number,
  priorScores: MatchScore[] = [],
): { ranksByMask: number[]; bestRank: number; worstRank: number } | null {
  if (!fixtures.length || fixtures.length > 12) return null

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

  return { ranksByMask, bestRank, worstRank }
}

function nearestReachableRank(
  ranksByMask: number[],
  target: number,
): number | undefined {
  let best: number | undefined
  let bestDist = Infinity
  const seen = new Set<number>()
  for (const rank of ranksByMask) {
    if (seen.has(rank)) continue
    seen.add(rank)
    const dist = Math.abs(rank - target)
    if (dist < bestDist || (dist === bestDist && (best == null || rank < best))) {
      bestDist = dist
      best = rank
    }
  }
  return best
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

  const enumerated = enumerateMatchdayRanksByMask(
    baseStandings,
    fixtures,
    teamId,
    priorScores,
  )
  if (!enumerated) return null

  const { ranksByMask, bestRank, worstRank } = enumerated
  const bestMasks: number[] = []
  const worstMasks: number[] = []
  for (let mask = 0; mask < ranksByMask.length; mask++) {
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

/**
 * Wunschplatz nach dem nächsten Spieltag (exakte Enumeration).
 * comparator exact: Rang == target · atLeast: Rang <= target.
 */
export function computeTargetMatchdayOutlook(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  target: number,
  comparator: TargetComparator,
  priorScores: MatchScore[] = [],
): TargetOutlook | null {
  const matchday = nextOpenMatchday(remaining)
  if (matchday == null) return null
  const fixtures = matchesOnMatchday(remaining, matchday)
  if (!fixtures.length) return null

  const clampedTarget = Math.max(1, Math.min(baseStandings.length, Math.floor(target)))

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
    const lo = Math.min(best.rank, worst.rank)
    const hi = Math.max(best.rank, worst.rank)
    const reachable =
      comparator === 'exact'
        ? clampedTarget >= lo && clampedTarget <= hi
        : lo <= clampedTarget
    return {
      target: clampedTarget,
      comparator,
      reachable,
      nearestReachable: reachable
        ? undefined
        : Math.abs(lo - clampedTarget) <= Math.abs(hi - clampedTarget)
          ? lo
          : hi,
    }
  }

  const enumerated = enumerateMatchdayRanksByMask(
    baseStandings,
    fixtures,
    teamId,
    priorScores,
  )
  if (!enumerated) return null

  const { ranksByMask } = enumerated
  const targetMasks: number[] = []
  for (let mask = 0; mask < ranksByMask.length; mask++) {
    if (matchesTargetRank(ranksByMask[mask]!, clampedTarget, comparator)) {
      targetMasks.push(mask)
    }
  }

  if (!targetMasks.length) {
    return {
      target: clampedTarget,
      comparator,
      reachable: false,
      nearestReachable: nearestReachableRank(ranksByMask, clampedTarget),
    }
  }

  const conditions = deriveExactCaseConditions(
    fixtures,
    teamId,
    targetMasks,
    'target',
  )
  const ownOptions = collectOwnTargetOptions(
    fixtures,
    teamId,
    targetMasks,
    conditions.ownMatch?.focusResult ?? null,
  )

  return {
    target: clampedTarget,
    comparator,
    reachable: true,
    conditions,
    ownOptions: ownOptions.length > 0 ? ownOptions : undefined,
  }
}

/**
 * Wunschplatz über die Saison: Heuristik + optional Monte-Carlo-Stats.
 * forecast null → nur heuristische Richtung (kein Wahrscheinlichkeits-Block).
 */
export function computeTargetSeasonOutlook(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  target: number,
  comparator: TargetComparator,
  priorScores: MatchScore[] = [],
  forecast: {
    runs: number
    rankCounts: number[]
    /** Punkte je Lauf, in denen Rang dem Ziel genügt (optional) */
    targetPointsSamples?: number[]
  } | null = null,
): TargetOutlook | null {
  const focus = baseStandings.find((s) => s.teamId === teamId)
  if (!focus) return null

  const clampedTarget = Math.max(1, Math.min(baseStandings.length, Math.floor(target)))
  const extremes = seasonExtremeOutcomes(
    baseStandings,
    remaining,
    teamId,
    priorScores,
  )
  if (!extremes?.length) return null

  const bestRank = Math.min(...extremes.map((e) => e.rank))
  const worstRank = Math.max(...extremes.map((e) => e.rank))

  let reachable =
    comparator === 'exact'
      ? clampedTarget >= bestRank && clampedTarget <= worstRank
      : bestRank <= clampedTarget

  let season: TargetOutlook['season']
  if (forecast && forecast.runs > 0) {
    const counts = forecast.rankCounts
    let exact = 0
    let atLeast = 0
    for (let i = 0; i < counts.length; i++) {
      const c = counts[i] ?? 0
      const rank = i + 1
      if (rank === clampedTarget) exact += c
      if (rank <= clampedTarget) atLeast += c
    }
    const pExact = exact / forecast.runs
    const pAtLeast = atLeast / forecast.runs
    const hitProb = comparator === 'exact' ? pExact : pAtLeast
    if (hitProb <= 0) reachable = false

    const samples = forecast.targetPointsSamples ?? []
    let medianPoints: number | null = null
    if (samples.length > 0) {
      const sorted = [...samples].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      medianPoints =
        sorted.length % 2 === 1
          ? sorted[mid]!
          : (sorted[mid - 1]! + sorted[mid]!) / 2
    }
    season = {
      pExact,
      pAtLeast,
      medianPoints,
      pointsNeeded:
        medianPoints != null ? Math.max(0, medianPoints - focus.points) : null,
    }
  }

  if (!reachable) {
    const nearest =
      comparator === 'atLeast'
        ? bestRank
        : Math.abs(bestRank - clampedTarget) <= Math.abs(worstRank - clampedTarget)
          ? bestRank
          : worstRank
    return {
      target: clampedTarget,
      comparator,
      reachable: false,
      nearestReachable: nearest,
      season,
    }
  }

  const heuristicMode: 'best' | 'worst' =
    clampedTarget < focus.rank ? 'best' : clampedTarget > focus.rank ? 'worst' : 'best'

  const conditions = deriveHeuristicSeasonConditions(
    baseStandings,
    remaining,
    teamId,
    heuristicMode,
  )

  return {
    target: clampedTarget,
    comparator,
    reachable: true,
    conditions,
    season,
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

/** Best-/Schlechtfall-Outcomes für die Saison (exakt im Limit, sonst Heuristik). */
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

  const relevantMatches = relevantMatchesForTeam(
    baseStandings,
    remaining,
    teamId,
  )
  if (relevantMatches.length <= EXACT_LIMIT) {
    if (relevantMatches.length === 0) {
      const row = baseStandings.find((s) => s.teamId === teamId)
      if (!row) return null
      return [{ points: row.points, rank: row.rank }]
    }
    const enumerated = enumerateSeasonRanksByMaskForTeam(
      baseStandings,
      relevantMatches,
      teamId,
      priorScores,
    )
    if (!enumerated) return null
    const { ranksByMask, pointsByMask } = enumerated
    let bestRank = baseStandings.length
    let worstRank = 1
    let bestPoints = -Infinity
    let worstPoints = Infinity
    for (let i = 0; i < ranksByMask.length; i++) {
      const rank = ranksByMask[i]!
      const pts = pointsByMask[i]!
      if (rank < bestRank || (rank === bestRank && pts > bestPoints)) {
        bestRank = rank
        bestPoints = pts
      }
      if (rank > worstRank || (rank === worstRank && pts < worstPoints)) {
        worstRank = rank
        worstPoints = pts
      }
    }
    return [
      { points: bestPoints, rank: bestRank },
      { points: worstPoints, rank: worstRank },
    ]
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
