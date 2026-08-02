import type { Match, MatchResult, ScenarioResult } from '../types'

/** Normales Polling ohne laufende Spiele. */
export const POLL_MS = 60_000

/** Schnelleres Polling, solange mindestens ein Spiel läuft. */
export const LIVE_POLL_MS = 20_000

/**
 * Spiele älter als diese Dauer nach Anstoß gelten nicht mehr als „Live“
 * (verhindert hängengebliebene OpenLigaDB-Flags).
 */
export const LIVE_MAX_AGE_MS = 6 * 60 * 60 * 1000

export interface LiveMatchView {
  match: Match
  homeGoals: number
  awayGoals: number
  /** true wenn mind. ein matchResult vorliegt */
  hasScore: boolean
  resultName: string | null
}

function kickoffMs(match: Match): number | null {
  const raw = match.matchDateTimeUTC || match.matchDateTime
  if (!raw) return null
  const t = Date.parse(raw)
  return Number.isNaN(t) ? null : t
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
 * Zwischenstand optional (ohne Results → 0:0 / hasScore false).
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

export function scoreKey(homeGoals: number, awayGoals: number): string {
  return `${homeGoals}:${awayGoals}`
}
