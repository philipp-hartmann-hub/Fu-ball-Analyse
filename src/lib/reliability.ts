/**
 * Gemeinsame Aussagekraft-Schwelle für Härte und Prognose.
 * Unter MIN_GAMES Spielen (Liga-Median) sind PPG-/Tor-Stärken zu verrauscht
 * bzw. kollabieren auf Fallback-Werte — UI unterdrückt dann Ranking/Prozente.
 */

export const MIN_GAMES = 5

/** Median der `played`-Werte; leere Liga → 0. */
export function medianGamesPlayed(
  standings: ReadonlyArray<{ played: number }>,
): number {
  if (standings.length === 0) return 0
  const sorted = standings.map((s) => s.played).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** true, wenn der Liga-Median gespielter Spiele ≥ MIN_GAMES. */
export function hasEnoughData(
  standings: ReadonlyArray<{ played: number }>,
): boolean {
  return medianGamesPlayed(standings) >= MIN_GAMES
}

/** UI-Text, wenn Härte/Prognose noch keine Aussage treffen. */
export const NOT_ENOUGH_DATA_LABEL = 'noch keine Aussage (zu wenige Spiele)'
