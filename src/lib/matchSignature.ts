import type { Match } from '../types'
import { finalResult } from './table'

/**
 * Billige Inhalts-Signatur für Poll-Vergleiche (ohne Objekt-Referenz).
 * Gleichheit ⇒ keine Tabellen-/Outlook-Neuberechnung nötig.
 */
export function matchesContentSignature(matches: readonly Match[]): string {
  if (matches.length === 0) return ''
  const parts: string[] = new Array(matches.length)
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!
    const end = finalResult(m)
    const g1 = end?.pointsTeam1 ?? -1
    const g2 = end?.pointsTeam2 ?? -1
    parts[i] =
      `${m.matchID}:${m.matchIsFinished ? 1 : 0}:${g1}:${g2}:${m.lastUpdateDateTime}`
  }
  return parts.join('|')
}

/**
 * Stabile Key-Signatur für useMemo (Cutoff + Live-Szenarien fließen separat ein).
 * Unabhängig von Array-Referenz / Poll-Identität.
 */
export function matchesDataVersion(matches: readonly Match[]): string {
  return matchesContentSignature(matches)
}
