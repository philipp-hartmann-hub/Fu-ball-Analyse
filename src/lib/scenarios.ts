import type {
  CaseConditions,
  HardRange,
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

/**
 * Tordifferenz-Puffer für Fokus-Siege/-Niederlagen (Spieltag + Saison-Fokus/Heuristik).
 * Fremdspiele bleiben Minimal-Tore (1:0 / 1:1 / 0:1). Wert ≥6, damit typische
 * GD-/Tore-Überholmanöver (z. B. Heidenheim nach ST31) nicht unterschätzt werden.
 */
export const FOCUS_EXTREME_MARGIN = 8

/** Tore für ein Spiel unter Masken-Index; Fokus bekommt Extreme-Margin. */
export function scorelineForFixture(
  match: Match,
  outcomeIdx: number,
  focusId: number,
  focusWinMargin: number = FOCUS_EXTREME_MARGIN,
  focusLossMargin: number = FOCUS_EXTREME_MARGIN,
): [number, number] {
  if (outcomeIdx === 1) return [1, 1]
  const homeWins = outcomeIdx === 0
  const focusHome = match.team1.teamId === focusId
  const focusAway = match.team2.teamId === focusId
  if (!focusHome && !focusAway) {
    return homeWins ? [1, 0] : [0, 1]
  }
  if (focusHome) {
    return homeWins ? [focusWinMargin, 0] : [0, focusLossMargin]
  }
  // Fokus auswärts
  return homeWins ? [focusLossMargin, 0] : [0, focusWinMargin]
}

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
  if (cond.mode === 'exact' && cond.ownMatch) {
    const own = cond.ownMatch
    const gd = Math.max(1, own.minGoalDiff ?? 1)
    if (own.outcome === 'draw') {
      out.push(scenarioFromOutcome(own.matchId, 'draw'))
    } else if (own.outcome === 'home') {
      out.push(scenarioFromScore(own.matchId, gd, 0))
    } else {
      out.push(scenarioFromScore(own.matchId, 0, gd))
    }
  }
  if (cond.mode === 'heuristic') {
    for (const own of cond.ownRest) {
      out.push(scenarioFromOutcome(own.matchId, own.outcome))
    }
  }
  for (const req of cond.required) {
    out.push(scenarioFromOutcome(req.matchId, req.outcome))
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
  const focus = map.get(focusId)!
  const appearances = countRemainingAppearances(remaining)

  /** Rivale kann den Fokus rechnerisch noch einholen (max. Punkte ≥ Fokus-Punkte). */
  const canCatchFocus = (teamId: number): boolean => {
    if (teamId === focusId) return false
    const row = map.get(teamId)
    if (!row) return false
    const left = appearances.get(teamId) ?? 0
    return row.points + 3 * left >= focus.points
  }

  /** Fokus kann dieses Team rechnerisch noch einholen. */
  const focusCanCatch = (teamId: number): boolean => {
    if (teamId === focusId) return false
    const row = map.get(teamId)
    if (!row) return false
    const focusLeft = appearances.get(focusId) ?? 0
    return focus.points + 3 * focusLeft >= row.points
  }

  for (const match of remaining) {
    const homeId = match.team1.teamId
    const awayId = match.team2.teamId
    const focusHome = homeId === focusId
    const focusAway = awayId === focusId
    let homeGoals = 0
    let awayGoals = 0

    if (focusHome || focusAway) {
      if (mode === 'best') {
        homeGoals = focusHome ? FOCUS_EXTREME_MARGIN : 0
        awayGoals = focusAway ? FOCUS_EXTREME_MARGIN : 0
      } else {
        homeGoals = focusHome ? 0 : FOCUS_EXTREME_MARGIN
        awayGoals = focusAway ? 0 : FOCUS_EXTREME_MARGIN
      }
    } else if (mode === 'best') {
      // Bestfall: bedrohliche Rivalen sollen verlieren (große Marge), sonst minimal
      const homeThreat = canCatchFocus(homeId) || focusCanCatch(homeId)
      const awayThreat = canCatchFocus(awayId) || focusCanCatch(awayId)
      if (homeThreat && !awayThreat) {
        // Heim-Rivale soll verlieren → Auswärts siegt groß
        homeGoals = 0
        awayGoals = FOCUS_EXTREME_MARGIN
      } else if (awayThreat && !homeThreat) {
        homeGoals = FOCUS_EXTREME_MARGIN
        awayGoals = 0
      } else if (homeThreat && awayThreat) {
        homeGoals = 1
        awayGoals = 1
      } else {
        homeGoals = 1
        awayGoals = 1
      }
    } else {
      // Schlechtfall: Rivalen, die den Fokus einholen können, gewinnen groß
      const homeThreat = canCatchFocus(homeId)
      const awayThreat = canCatchFocus(awayId)
      if (homeThreat && !awayThreat) {
        homeGoals = FOCUS_EXTREME_MARGIN
        awayGoals = 0
      } else if (awayThreat && !homeThreat) {
        homeGoals = 0
        awayGoals = FOCUS_EXTREME_MARGIN
      } else if (homeThreat && awayThreat) {
        const home = map.get(homeId)!
        const away = map.get(awayId)!
        if (home.points >= away.points) {
          homeGoals = FOCUS_EXTREME_MARGIN
          awayGoals = 0
        } else {
          homeGoals = 0
          awayGoals = FOCUS_EXTREME_MARGIN
        }
      } else {
        const home = map.get(homeId)!
        const away = map.get(awayId)!
        if (home.points >= away.points) {
          homeGoals = 1
          awayGoals = 0
        } else {
          homeGoals = 0
          awayGoals = 1
        }
      }
    }

    applyOutcome(map, homeId, awayId, homeGoals, awayGoals)
    // appearances für Folge-Spiele: bereits gespielte zählen wir nicht zurück —
    // canCatch nutzt Rest aus `remaining`-Zählung (statisch ok als Näherung)
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

/** Export für Tests / Heuristik-Dokumentation. */
export function simulateExtremeFinishForTest(
  baseStandings: StandingRow[],
  remaining: Match[],
  focusId: number,
  mode: 'best' | 'worst',
  priorScores: MatchScore[] = [],
): PointRankOutcome {
  return simulateExtremeFinish(
    baseStandings,
    remaining,
    focusId,
    mode,
    priorScores,
  )
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
    mode: 'exact' as const,
  }))
}

function hardAsPositionRange(hard: HardRange): PositionRange {
  return {
    teamId: hard.teamId,
    bestRank: hard.hardBest,
    worstRank: hard.hardWorst,
    mode: 'hard',
  }
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
    mode: 'exact' as const,
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
      const outcomeIdx = x % 3
      x = Math.floor(x / 3)
      const [hg, ag] = scorelineForFixture(match, outcomeIdx, teamId)
      applyScore(map, match.team1.teamId, match.team2.teamId, hg, ag)
      scores.push({
        matchId: match.matchID,
        homeId: match.team1.teamId,
        awayId: match.team2.teamId,
        homeGoals: hg,
        awayGoals: ag,
      })
    }
    const row = map.get(teamId)!
    const table = rankStandings([...map.values()], { matchScores: scores })
    ranksByMask[mask] = table.find((r) => r.teamId === teamId)!.rank
    pointsByMask[mask] = row.points
  }

  return { ranksByMask, pointsByMask }
}

/**
 * Restspiele der Punkte-Komponente eines Teams (relevante Spiele nach Pruning).
 * Die Exact-Grenze (EXACT_LIMIT) gilt pro Verein über diese Liste — nicht global
 * über alle Ligarestspiele oder einen festen Spieltag.
 */
export function relevantMatchesForTeam(
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

/**
 * Harte Spanne für ein Team — mathematisch garantierter Rangbereich.
 *
 * SOUND: der wahre Endrang liegt immer in [hardBest, hardWorst].
 * Nicht zwingend scharf (kann weiter sein als Exact/Heuristik).
 * Gleichstände zählen bewusst NICHT als „certainly“ (Tiebreak könnte kippen).
 */
export function computeHardBounds(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
): HardRange | null {
  const focus = baseStandings.find((s) => s.teamId === teamId)
  if (!focus) return null

  const games = countRemainingAppearances(remaining)
  const ownRemaining = games.get(teamId) ?? 0
  const focusMax = focus.points + 3 * ownRemaining
  const focusCurrent = focus.points
  const n = baseStandings.length

  let certainlyAbove = 0
  let certainlyBelow = 0
  for (const team of baseStandings) {
    if (team.teamId === teamId) continue
    const teamRemaining = games.get(team.teamId) ?? 0
    const maxPts = team.points + 3 * teamRemaining
    if (team.points > focusMax) certainlyAbove += 1
    if (maxPts < focusCurrent) certainlyBelow += 1
  }

  return {
    teamId,
    hardBest: 1 + certainlyAbove,
    hardWorst: n - certainlyBelow,
  }
}

/** Harte Spannen für die ganze Tabelle — max-Punkte einmal vorberechnen. */
export function computeHardRanges(
  baseStandings: StandingRow[],
  remaining: Match[],
): HardRange[] {
  const games = countRemainingAppearances(remaining)
  const maxPtsByTeam = new Map<number, number>()
  for (const row of baseStandings) {
    const g = games.get(row.teamId) ?? 0
    maxPtsByTeam.set(row.teamId, row.points + 3 * g)
  }
  const n = baseStandings.length

  return baseStandings.map((focus) => {
    const focusMax = maxPtsByTeam.get(focus.teamId)!
    const focusCurrent = focus.points
    let certainlyAbove = 0
    let certainlyBelow = 0
    for (const team of baseStandings) {
      if (team.teamId === focus.teamId) continue
      if (team.points > focusMax) certainlyAbove += 1
      if (maxPtsByTeam.get(team.teamId)! < focusCurrent) certainlyBelow += 1
    }
    return {
      teamId: focus.teamId,
      hardBest: 1 + certainlyAbove,
      hardWorst: n - certainlyBelow,
    }
  })
}

function resolveHardRange(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
): HardRange | null {
  const hard = computeHardBounds(baseStandings, remaining, teamId)
  if (hard) return hard
  const row = baseStandings.find((s) => s.teamId === teamId)
  if (!row) return null
  return { teamId, hardBest: row.rank, hardWorst: row.rank }
}

export function computeSeasonOutlook(
  baseStandings: StandingRow[],
  remaining: Match[],
  teamId: number,
  priorScores: MatchScore[] = [],
): SeasonOutlook | null {
  const hardRange = resolveHardRange(baseStandings, remaining, teamId)
  if (!hardRange) return null

  if (!remaining.length) {
    const row = baseStandings.find((s) => s.teamId === teamId)
    if (!row) return null
    return {
      range: {
        teamId,
        bestRank: row.rank,
        worstRank: row.rank,
        mode: 'exact',
      },
      hardRange,
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
        range: {
          teamId,
          bestRank: row.rank,
          worstRank: row.rank,
          mode: 'exact',
        },
        hardRange,
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
    // Saison: nur Spanne — keine Pathway-/Wunschplatz-Bedingungen
    return {
      range: { teamId, bestRank, worstRank, mode: 'exact' },
      hardRange,
      bestConditions: null,
      worstConditions: null,
    }
  }

  // Außerhalb Exact-Limit: harte Außengrenze (kein innere-Näherungs-Heuristik)
  return {
    range: hardAsPositionRange(hardRange),
    hardRange,
    bestConditions: null,
    worstConditions: null,
  }
}

/**
 * Spannen für alle Teams (Tabellenspalte „Möglich“).
 * Pro Punkte-Komponente: Exact wenn ≤ EXACT_LIMIT relevante Spiele, sonst hart.
 */
export function computePositionRanges(
  baseStandings: StandingRow[],
  remaining: Match[],
  priorScores: MatchScore[] = [],
): PositionRange[] {
  if (!remaining.length) return fixedPositionRanges(baseStandings)

  const nTeams = baseStandings.length
  const hardByTeam = new Map(
    computeHardRanges(baseStandings, remaining).map((h) => [h.teamId, h]),
  )
  const bestByTeam = new Map<number, number>()
  const worstByTeam = new Map<number, number>()
  const modeByTeam = new Map<number, 'exact' | 'hard'>()

  for (const row of baseStandings) {
    const hard = hardByTeam.get(row.teamId)!
    bestByTeam.set(row.teamId, hard.hardBest)
    worstByTeam.set(row.teamId, hard.hardWorst)
    modeByTeam.set(row.teamId, 'hard')
  }

  const components = relevantPointComponents(baseStandings, remaining)

  for (const comp of components) {
    const matches = matchesTouchingTeams(remaining, new Set(comp))
    if (matches.length === 0) {
      for (const id of comp) {
        const row = baseStandings.find((s) => s.teamId === id)!
        bestByTeam.set(id, row.rank)
        worstByTeam.set(id, row.rank)
        modeByTeam.set(id, 'exact')
      }
      continue
    }
    if (matches.length <= EXACT_LIMIT) {
      for (const id of comp) {
        bestByTeam.set(id, nTeams)
        worstByTeam.set(id, 1)
      }
      accumulateRangesFromMasks(
        baseStandings,
        matches,
        priorScores,
        bestByTeam,
        worstByTeam,
        new Set(comp),
      )
      for (const id of comp) modeByTeam.set(id, 'exact')
    }
    // sonst: harte Defaults bleiben
  }

  return baseStandings.map((row) => ({
    teamId: row.teamId,
    bestRank: bestByTeam.get(row.teamId)!,
    worstRank: worstByTeam.get(row.teamId)!,
    mode: modeByTeam.get(row.teamId)!,
  }))
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
    const rank = rankForMatchdayMask(
      baseStandings,
      fixtures,
      teamId,
      mask,
      priorScores,
      FOCUS_EXTREME_MARGIN,
      FOCUS_EXTREME_MARGIN,
    )
    ranksByMask[mask] = rank
    if (rank < bestRank) bestRank = rank
    if (rank > worstRank) worstRank = rank
  }

  return { ranksByMask, bestRank, worstRank }
}

function rankForMatchdayMask(
  baseStandings: StandingRow[],
  fixtures: Match[],
  teamId: number,
  mask: number,
  priorScores: MatchScore[],
  focusWinMargin: number,
  focusLossMargin: number,
): number {
  // Arbeitskopie der numerischen Felder (einmal pro Maske, kein deep Clone der Meta)
  const n = baseStandings.length
  const ids = new Array<number>(n)
  const points = new Int32Array(n)
  const gd = new Int32Array(n)
  const gf = new Int32Array(n)
  const ga = new Int32Array(n)
  const played = new Int32Array(n)
  const won = new Int32Array(n)
  const draw = new Int32Array(n)
  const lost = new Int32Array(n)
  const indexById = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const s = baseStandings[i]!
    ids[i] = s.teamId
    indexById.set(s.teamId, i)
    points[i] = s.points
    gd[i] = s.goalDiff
    gf[i] = s.goalsFor
    ga[i] = s.goalsAgainst
    played[i] = s.played
    won[i] = s.won
    draw[i] = s.draw
    lost[i] = s.lost
  }

  const scores: MatchScore[] = [...priorScores]
  let x = mask
  for (const match of fixtures) {
    const outcomeIdx = x % 3
    x = Math.floor(x / 3)
    const [hg, ag] = scorelineForFixture(
      match,
      outcomeIdx,
      teamId,
      focusWinMargin,
      focusLossMargin,
    )
    const hi = indexById.get(match.team1.teamId)!
    const ai = indexById.get(match.team2.teamId)!
    played[hi]++
    played[ai]++
    gf[hi] += hg
    ga[hi] += ag
    gf[ai] += ag
    ga[ai] += hg
    gd[hi] = gf[hi] - ga[hi]
    gd[ai] = gf[ai] - ga[ai]
    if (hg > ag) {
      won[hi]++
      lost[ai]++
      points[hi] += 3
    } else if (hg < ag) {
      won[ai]++
      lost[hi]++
      points[ai] += 3
    } else {
      draw[hi]++
      draw[ai]++
      points[hi]++
      points[ai]++
    }
    scores.push({
      matchId: match.matchID,
      homeId: match.team1.teamId,
      awayId: match.team2.teamId,
      homeGoals: hg,
      awayGoals: ag,
    })
  }

  const drafts: StandingRow[] = baseStandings.map((s, i) => ({
    ...s,
    points: points[i]!,
    goalDiff: gd[i]!,
    goalsFor: gf[i]!,
    goalsAgainst: ga[i]!,
    played: played[i]!,
    won: won[i]!,
    draw: draw[i]!,
    lost: lost[i]!,
    rank: 0,
  }))
  return rankOf(drafts, teamId, scores)
}

/**
 * Kleinste Fokus-Tordifferenz (Sieg/Niederlage), mit der mindestens eine der
 * Masken den Zielrang noch erreicht. Remis → null.
 */
export function minFocusGoalDiffForMasks(
  baseStandings: StandingRow[],
  fixtures: Match[],
  teamId: number,
  masks: number[],
  priorScores: MatchScore[],
  targetRank: number,
  focusResult: 'win' | 'draw' | 'loss',
): number | null {
  if (!masks.length || focusResult === 'draw') return null

  const ownIdx = fixtures.findIndex(
    (m) => m.team1.teamId === teamId || m.team2.teamId === teamId,
  )
  if (ownIdx < 0) return null

  for (let margin = 1; margin <= FOCUS_EXTREME_MARGIN + 2; margin++) {
    const winM = focusResult === 'win' ? margin : FOCUS_EXTREME_MARGIN
    const lossM = focusResult === 'loss' ? margin : FOCUS_EXTREME_MARGIN
    for (const mask of masks) {
      const rank = rankForMatchdayMask(
        baseStandings,
        fixtures,
        teamId,
        mask,
        priorScores,
        winM,
        lossM,
      )
      if (rank === targetRank) return margin
    }
  }
  return FOCUS_EXTREME_MARGIN
}

/**
 * Masken, die mit gegebener Fokus-Margin noch den Zielrang erreichen.
 * Für engere Muss/Darf-nicht-Klassifikation nach TD-Berechnung.
 */
function masksStillAtRankWithMargin(
  baseStandings: StandingRow[],
  fixtures: Match[],
  teamId: number,
  masks: number[],
  priorScores: MatchScore[],
  targetRank: number,
  focusResult: 'win' | 'draw' | 'loss',
  margin: number,
): number[] {
  if (focusResult === 'draw') return masks
  const winM = focusResult === 'win' ? margin : FOCUS_EXTREME_MARGIN
  const lossM = focusResult === 'loss' ? margin : FOCUS_EXTREME_MARGIN
  return masks.filter(
    (mask) =>
      rankForMatchdayMask(
        baseStandings,
        fixtures,
        teamId,
        mask,
        priorScores,
        winM,
        lossM,
      ) === targetRank,
  )
}

/** Baut Spieltag-Bedingungen inkl. Mindest-TD und engerer Maskenfilterung. */
function buildMatchdayCaseConditions(
  baseStandings: StandingRow[],
  fixtures: Match[],
  teamId: number,
  optimalMasks: number[],
  mode: 'best' | 'worst' | 'target',
  targetRank: number,
  priorScores: MatchScore[],
): CaseConditions {
  const draft = deriveExactCaseConditions(fixtures, teamId, optimalMasks, mode)
  const focusResult = draft.ownMatch?.focusResult ?? null
  if (!focusResult || focusResult === 'draw' || !draft.ownMatch) {
    return draft
  }

  const ownIdx = fixtures.findIndex(
    (m) => m.team1.teamId === teamId || m.team2.teamId === teamId,
  )
  const outcomeAt = (mask: number, fi: number) =>
    Math.floor(mask / 3 ** fi) % 3
  const ownOi =
    ownIdx >= 0 && draft.ownMatch
      ? ['home', 'draw', 'away'].indexOf(draft.ownMatch.outcome)
      : -1
  const ownFiltered =
    ownIdx >= 0 && ownOi >= 0
      ? optimalMasks.filter((m) => outcomeAt(m, ownIdx) === ownOi)
      : optimalMasks

  const minGd = minFocusGoalDiffForMasks(
    baseStandings,
    fixtures,
    teamId,
    ownFiltered,
    priorScores,
    targetRank,
    focusResult,
  )

  let masksForClassify = ownFiltered
  if (minGd != null && minGd > 0) {
    const tight = masksStillAtRankWithMargin(
      baseStandings,
      fixtures,
      teamId,
      ownFiltered,
      priorScores,
      targetRank,
      focusResult,
      minGd,
    )
    if (tight.length > 0) masksForClassify = tight
  }

  // Erneut ableiten aus der TD-engeren Menge → mehr Muss / Darf nicht
  const tightened = deriveExactCaseConditions(
    fixtures,
    teamId,
    masksForClassify,
    mode,
  )
  if (tightened.ownMatch) {
    tightened.ownMatch = {
      ...tightened.ownMatch,
      minGoalDiff: minGd,
    }
  }
  return tightened
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
  const hardRange = resolveHardRange(baseStandings, fixtures, teamId)
  if (!hardRange) return null

  if (fixtures.length > 12) {
    return {
      matchday,
      fixtureCount: fixtures.length,
      plays,
      opponentName,
      opponentIconUrl,
      homeAway,
      range: hardAsPositionRange(hardRange),
      hardRange,
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
    range: { teamId, bestRank, worstRank, mode: 'exact' },
    hardRange,
    bestConditions: buildMatchdayCaseConditions(
      baseStandings,
      fixtures,
      teamId,
      bestMasks,
      'best',
      bestRank,
      priorScores,
    ),
    worstConditions: buildMatchdayCaseConditions(
      baseStandings,
      fixtures,
      teamId,
      worstMasks,
      'worst',
      worstRank,
      priorScores,
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

  const conditions = buildMatchdayCaseConditions(
    baseStandings,
    fixtures,
    teamId,
    targetMasks,
    'target',
    Math.min(...targetMasks.map((m) => ranksByMask[m]!)),
    priorScores,
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
      const outcomeIdx = x % 3
      x = Math.floor(x / 3)
      const [hg, ag] = scorelineForFixture(match, outcomeIdx, teamId)
      applyOutcome(map, match.team1.teamId, match.team2.teamId, hg, ag)
      scores.push({
        matchId: match.matchID,
        homeId: match.team1.teamId,
        awayId: match.team2.teamId,
        homeGoals: hg,
        awayGoals: ag,
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

/**
 * Dieselben Spieltags-Outcomes wie `enumerateMatchdayOutcomes`, aber in einem
 * 3ⁿ-Durchlauf für alle Teams. Fokus-Tore nur am eigenen Spiel (identisch zur
 * Einzel-Enumeration); die übrigen Spiele bleiben 1:0 / 1:1 / 0:1.
 */
export function enumerateMatchdayOutcomesByTeam(
  baseStandings: StandingRow[],
  remaining: Match[],
  priorScores: MatchScore[] = [],
): Map<number, PointRankOutcome[]> | null {
  const matchday = nextOpenMatchday(remaining)
  if (matchday == null) return null
  const fixtures = matchesOnMatchday(remaining, matchday)
  if (!fixtures.length) return null

  if (fixtures.length > 12) {
    const byTeam = new Map<number, PointRankOutcome[]>()
    for (const row of baseStandings) {
      const out = enumerateMatchdayOutcomes(
        baseStandings,
        remaining,
        row.teamId,
        priorScores,
      )
      if (out) byTeam.set(row.teamId, out)
    }
    return byTeam.size ? byTeam : null
  }

  const byTeam = new Map<number, PointRankOutcome[]>()
  for (const row of baseStandings) byTeam.set(row.teamId, [])

  const total = 3 ** fixtures.length
  const ranksFrom = (
    table: Map<number, StandingRow>,
    scores: MatchScore[],
  ): Map<number, number> => {
    const ranked = rankStandings(toDrafts([...table.values()]), {
      matchScores: scores,
    })
    return new Map(ranked.map((r) => [r.teamId, r.rank]))
  }

  const patchOwnMatch = (
    table: Map<number, StandingRow>,
    scores: MatchScore[],
    match: Match,
    outcomeIdx: number,
    focusId: number,
  ): (() => void) | null => {
    const [oldH, oldA] = scorelineForFixture(match, outcomeIdx, -1)
    const [newH, newA] = scorelineForFixture(match, outcomeIdx, focusId)
    if (oldH === newH && oldA === newA) return null
    const home = table.get(match.team1.teamId)
    const away = table.get(match.team2.teamId)
    if (!home || !away) return null
    const dH = newH - oldH
    const dA = newA - oldA
    home.goalsFor += dH
    home.goalsAgainst += dA
    away.goalsFor += dA
    away.goalsAgainst += dH
    home.goalDiff = home.goalsFor - home.goalsAgainst
    away.goalDiff = away.goalsFor - away.goalsAgainst
    const si = scores.findIndex((s) => s.matchId === match.matchID)
    const prev = si >= 0 ? scores[si]! : null
    if (si >= 0) {
      scores[si] = { ...prev!, homeGoals: newH, awayGoals: newA }
    }
    return () => {
      home.goalsFor -= dH
      home.goalsAgainst -= dA
      away.goalsFor -= dA
      away.goalsAgainst -= dH
      home.goalDiff = home.goalsFor - home.goalsAgainst
      away.goalDiff = away.goalsFor - away.goalsAgainst
      if (si >= 0 && prev) scores[si] = prev
    }
  }

  for (let mask = 0; mask < total; mask++) {
    const idxs: number[] = []
    let x = mask
    for (let i = 0; i < fixtures.length; i++) {
      idxs.push(x % 3)
      x = Math.floor(x / 3)
    }

    const table = new Map(baseStandings.map((s) => [s.teamId, cloneRow(s)]))
    const scores: MatchScore[] = [...priorScores]
    for (let i = 0; i < fixtures.length; i++) {
      const match = fixtures[i]!
      const [hg, ag] = scorelineForFixture(match, idxs[i]!, -1)
      applyOutcome(table, match.team1.teamId, match.team2.teamId, hg, ag)
      scores.push({
        matchId: match.matchID,
        homeId: match.team1.teamId,
        awayId: match.team2.teamId,
        homeGoals: hg,
        awayGoals: ag,
      })
    }

    const genericRanks = ranksFrom(table, scores)
    const recorded = new Set<number>()

    for (let i = 0; i < fixtures.length; i++) {
      const match = fixtures[i]!
      const revert = patchOwnMatch(
        table,
        scores,
        match,
        idxs[i]!,
        match.team1.teamId,
      )
      const ranks = revert ? ranksFrom(table, scores) : genericRanks
      for (const teamId of [match.team1.teamId, match.team2.teamId]) {
        const live = table.get(teamId)
        const list = byTeam.get(teamId)
        if (live && list) {
          list.push({
            points: live.points,
            rank: ranks.get(teamId) ?? live.rank,
          })
          recorded.add(teamId)
        }
      }
      revert?.()
    }

    for (const row of baseStandings) {
      if (recorded.has(row.teamId)) continue
      const live = table.get(row.teamId)
      const list = byTeam.get(row.teamId)
      if (!live || !list) continue
      list.push({
        points: live.points,
        rank: genericRanks.get(row.teamId) ?? live.rank,
      })
    }
  }

  return byTeam
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
