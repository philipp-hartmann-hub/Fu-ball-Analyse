import type { Match, MatchResult, ScenarioResult } from '../types'
import { finalResult } from './table'

/** Normales Polling ohne laufende Spiele. */
export const POLL_MS = 60_000

/** Schnelleres Polling, solange mindestens ein Spiel läuft. */
export const LIVE_POLL_MS = 20_000

/**
 * Spiele älter als diese Dauer nach Anstoß gelten nicht mehr als „Live“
 * (verhindert hängengebliebene OpenLigaDB-Flags).
 */
export const LIVE_MAX_AGE_MS = 6 * 60 * 60 * 1000

/**
 * Nach dem letzten Anstoß eines Spieltags bleibt er noch so lange die
 * Ergebnis-Übersicht – danach der nächste Spieltag.
 */
export const MATCHDAY_DISPLAY_HOLD_MS = 2 * 24 * 60 * 60 * 1000

export type MatchDisplayStatus = 'live' | 'finished' | 'upcoming'

export interface LiveMatchView {
  match: Match
  homeGoals: number
  awayGoals: number
  /** true wenn mind. ein matchResult vorliegt */
  hasScore: boolean
  resultName: string | null
}

export interface MatchdayFixtureView {
  match: Match
  status: MatchDisplayStatus
  homeGoals: number | null
  awayGoals: number | null
  hasScore: boolean
  resultName: string | null
  kickoffLabel: string
}

function kickoffMs(match: Match): number | null {
  const raw = match.matchDateTimeUTC || match.matchDateTime
  if (!raw) return null
  const t = Date.parse(raw)
  return Number.isNaN(t) ? null : t
}

export function matchKickoffMs(match: Match): number | null {
  return kickoffMs(match)
}

/**
 * Aktueller Zwischenstand: höchste resultOrderID (ohne Pflicht auf Endstand Type 2).
 * Fertige Spiele nutzen weiterhin finalResult in table.ts.
 */
export function liveScoreResult(match: Match): MatchResult | null {
  if (!match.matchResults?.length) return null
  return [...match.matchResults].sort((a, b) => b.resultOrderID - a.resultOrderID)[0] ?? null
}

/**
 * Laufendes Spiel: Anstoß in der Vergangenheit, nicht beendet,
 * und nicht älter als LIVE_MAX_AGE_MS.
 */
export function isLiveMatch(match: Match, nowMs: number = Date.now()): boolean {
  if (match.matchIsFinished) return false
  const start = kickoffMs(match)
  if (start == null || start > nowMs) return false
  if (nowMs - start > LIVE_MAX_AGE_MS) return false
  return true
}

export function listLiveMatches(
  matches: Match[],
  nowMs: number = Date.now(),
): LiveMatchView[] {
  const out: LiveMatchView[] = []
  for (const match of matches) {
    if (!isLiveMatch(match, nowMs)) continue
    const result = liveScoreResult(match)
    out.push({
      match,
      homeGoals: result?.pointsTeam1 ?? 0,
      awayGoals: result?.pointsTeam2 ?? 0,
      hasScore: result != null,
      resultName: result?.resultName ?? null,
    })
  }
  return out.sort((a, b) => {
    const da = a.match.group.groupOrderID - b.match.group.groupOrderID
    if (da !== 0) return da
    return a.match.matchID - b.match.matchID
  })
}

function lastKickoffOfDay(dayMatches: Match[]): number | null {
  let max: number | null = null
  for (const m of dayMatches) {
    const t = kickoffMs(m)
    if (t == null) continue
    if (max == null || t > max) max = t
  }
  return max
}

/**
 * Spieltag für die Ergebnis-Übersicht:
 * Erster Spieltag, der noch nicht „abgelaufen“ ist
 * (alle fertig UND letztes Spiel + 2 Tage vorbei) → sonst nächster.
 */
export function resolveResultsMatchday(
  matches: Match[],
  nowMs: number = Date.now(),
): number | null {
  const days = [...new Set(matches.map((m) => m.group.groupOrderID))].sort(
    (a, b) => a - b,
  )
  if (days.length === 0) return null

  for (const day of days) {
    const dayMatches = matches.filter((m) => m.group.groupOrderID === day)
    const allFinished = dayMatches.every((m) => m.matchIsFinished)
    const lastKo = lastKickoffOfDay(dayMatches)
    const expired =
      allFinished &&
      lastKo != null &&
      nowMs > lastKo + MATCHDAY_DISPLAY_HOLD_MS
    if (!expired) return day
  }

  return days[days.length - 1] ?? null
}

function formatKickoff(match: Match): string {
  const raw = match.matchDateTimeUTC || match.matchDateTime
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Alle Partien eines Spieltags für die Ergebnis-Übersicht. */
export function listMatchdayFixtures(
  matches: Match[],
  matchday: number,
  nowMs: number = Date.now(),
): MatchdayFixtureView[] {
  const dayMatches = matches
    .filter((m) => m.group.groupOrderID === matchday)
    .sort((a, b) => {
      const ta = kickoffMs(a) ?? 0
      const tb = kickoffMs(b) ?? 0
      if (ta !== tb) return ta - tb
      return a.matchID - b.matchID
    })

  return dayMatches.map((match) => {
    const kickoffLabel = formatKickoff(match)
    if (match.matchIsFinished) {
      const end = finalResult(match)
      return {
        match,
        status: 'finished' as const,
        homeGoals: end?.pointsTeam1 ?? null,
        awayGoals: end?.pointsTeam2 ?? null,
        hasScore: end != null,
        resultName: end?.resultName ?? 'Endstand',
        kickoffLabel,
      }
    }
    if (isLiveMatch(match, nowMs)) {
      const live = liveScoreResult(match)
      return {
        match,
        status: 'live' as const,
        homeGoals: live?.pointsTeam1 ?? 0,
        awayGoals: live?.pointsTeam2 ?? 0,
        hasScore: live != null,
        resultName: live?.resultName ?? 'Live',
        kickoffLabel,
      }
    }
    return {
      match,
      status: 'upcoming' as const,
      homeGoals: null,
      awayGoals: null,
      hasScore: false,
      resultName: null,
      kickoffLabel,
    }
  })
}

/** Zwischenstände als Szenarien für buildStandings (nur wenn Score vorliegt). */
export function liveMatchesToScenarios(live: LiveMatchView[]): ScenarioResult[] {
  return live
    .filter((l) => l.hasScore)
    .map((l) => ({
      matchId: l.match.matchID,
      homeGoals: l.homeGoals,
      awayGoals: l.awayGoals,
    }))
}

/** User-Szenarien überschreiben Live-Stände bei gleicher matchId. */
export function mergeScenarios(
  live: ScenarioResult[],
  user: ScenarioResult[],
): ScenarioResult[] {
  const map = new Map<number, ScenarioResult>()
  for (const s of live) map.set(s.matchId, s)
  for (const s of user) map.set(s.matchId, s)
  return [...map.values()]
}

export function scoreKey(homeGoals: number | null, awayGoals: number | null): string {
  return `${homeGoals ?? '-'}:${awayGoals ?? '-'}`
}

/** Halbzeitstand (resultTypeID === 1), falls vorhanden. */
export function halfTimeResult(match: Match): MatchResult | null {
  return (
    match.matchResults.find((r) => r.resultTypeID === 1) ??
    match.matchResults.find((r) => /halbzeit/i.test(r.resultName)) ??
    null
  )
}

export type GoalSide = 'home' | 'away' | 'unknown'

export interface MatchGoalView {
  key: string
  minute: number | null
  name: string
  side: GoalSide
  scoreLabel: string | null
  isPenalty: boolean
  isOwnGoal: boolean
  isOvertime: boolean
}

/**
 * Tore chronologisch für die Ergebnis-Detailansicht.
 * Seite: scoringTeamId, sonst aus dem Stand nach dem Tor.
 */
export function listMatchGoals(match: Match): MatchGoalView[] {
  const goals = [...(match.goals ?? [])].sort((a, b) => {
    const ma = a.matchMinute
    const mb = b.matchMinute
    if (ma == null && mb == null) return (a.goalID ?? 0) - (b.goalID ?? 0)
    if (ma == null) return 1
    if (mb == null) return -1
    if (ma !== mb) return ma - mb
    return (a.goalID ?? 0) - (b.goalID ?? 0)
  })

  return goals.map((g, i) => {
    let side: GoalSide = 'unknown'
    if (g.scoringTeamId === match.team1.teamId) side = 'home'
    else if (g.scoringTeamId === match.team2.teamId) side = 'away'
    else if (g.scoreTeam1 != null && g.scoreTeam2 != null) {
      const prev = goals[i - 1]
      const prev1 = prev?.scoreTeam1 ?? 0
      const prev2 = prev?.scoreTeam2 ?? 0
      if (g.scoreTeam1 > prev1) side = 'home'
      else if (g.scoreTeam2 > prev2) side = 'away'
    }

    const scoreLabel =
      g.scoreTeam1 != null && g.scoreTeam2 != null
        ? `${g.scoreTeam1}:${g.scoreTeam2}`
        : null

    return {
      key: `${g.goalID || i}-${g.matchMinute ?? 'x'}-${g.goalGetterName}`,
      minute: g.matchMinute ?? null,
      name: g.goalGetterName.trim() || 'Unbekannt',
      side,
      scoreLabel,
      isPenalty: g.isPenalty,
      isOwnGoal: g.isOwnGoal,
      isOvertime: g.isOvertime,
    }
  })
}
