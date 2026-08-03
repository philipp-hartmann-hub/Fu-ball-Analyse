import type { LeagueId } from '../leagues'
import type { ScenarioResult } from '../types'

export const SHARE_PARAM = 's'
export const SHARE_VERSION = 1 as const

export interface ShareState {
  leagueId: LeagueId
  season: number
  /** true = „Stand nach Spieltag“ aktiv */
  useCutoff: boolean
  /** Spieltag-Cutoff; nur relevant wenn useCutoff */
  asOfMatchday: number | null
  scenarios: ScenarioResult[]
}

type WireV1 = {
  v: typeof SHARE_VERSION
  l: LeagueId
  y: number
  /** Cutoff-Spieltag; fehlend/null = aus */
  c?: number | null
  /** [matchId, homeGoals, awayGoals] */
  s?: [number, number, number][]
}

function isLeagueId(value: unknown): value is LeagueId {
  return value === 'bl1' || value === 'bl2' || value === 'bl3'
}

function clampGoals(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(99, Math.floor(n)))
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(token: string): string | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const bin = atob(b64 + pad)
    const bytes = Uint8Array.from(bin, (ch: string) => ch.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function toWire(state: ShareState): WireV1 {
  const scenarios = state.scenarios.map(
    (s) =>
      [s.matchId, clampGoals(s.homeGoals), clampGoals(s.awayGoals)] as [
        number,
        number,
        number,
      ],
  )
  const wire: WireV1 = {
    v: SHARE_VERSION,
    l: state.leagueId,
    y: state.season,
    s: scenarios,
  }
  if (state.useCutoff && state.asOfMatchday != null && Number.isFinite(state.asOfMatchday)) {
    wire.c = Math.floor(state.asOfMatchday)
  } else {
    wire.c = null
  }
  return wire
}

function fromWire(raw: unknown): ShareState | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.v !== SHARE_VERSION) return null
  if (!isLeagueId(obj.l)) return null
  if (typeof obj.y !== 'number' || !Number.isFinite(obj.y)) return null

  const season = Math.floor(obj.y)
  if (season < 1990 || season > 2100) return null

  let useCutoff = false
  let asOfMatchday: number | null = null
  if (typeof obj.c === 'number' && Number.isFinite(obj.c)) {
    useCutoff = true
    asOfMatchday = Math.max(0, Math.floor(obj.c))
  }

  const scenarios: ScenarioResult[] = []
  if (obj.s != null) {
    if (!Array.isArray(obj.s)) return null
    for (const entry of obj.s) {
      if (!Array.isArray(entry) || entry.length < 3) continue
      const matchId = entry[0]
      const homeGoals = entry[1]
      const awayGoals = entry[2]
      if (typeof matchId !== 'number' || !Number.isFinite(matchId)) continue
      if (typeof homeGoals !== 'number' || typeof awayGoals !== 'number') continue
      const id = Math.floor(matchId)
      if (id <= 0) continue
      scenarios.push({
        matchId: id,
        homeGoals: clampGoals(homeGoals),
        awayGoals: clampGoals(awayGoals),
      })
    }
  }

  return {
    leagueId: obj.l,
    season,
    useCutoff,
    asOfMatchday,
    scenarios,
  }
}

/** Kodiert ShareState als base64url-Token für ?s= */
export function encodeShareState(state: ShareState): string {
  return toBase64Url(JSON.stringify(toWire(state)))
}

/** Dekodiert ?s=-Token; bei Fehlern null (nie werfen). */
export function decodeShareState(token: string): ShareState | null {
  if (!token || typeof token !== 'string') return null
  const json = fromBase64Url(token.trim())
  if (!json) return null
  try {
    return fromWire(JSON.parse(json) as unknown)
  } catch {
    return null
  }
}

export function readShareParam(search: string): string | null {
  try {
    const params = new URLSearchParams(
      search.startsWith('?') ? search : search ? `?${search}` : '',
    )
    const value = params.get(SHARE_PARAM)
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

export function loadShareStateFromSearch(search: string): ShareState | null {
  const token = readShareParam(search)
  if (!token) return null
  return decodeShareState(token)
}

/** Schreibt oder entfernt ?s= per replaceState (kein Reload). */
export function replaceShareQuery(token: string | null, href = location.href): string {
  const url = new URL(href)
  if (token) url.searchParams.set(SHARE_PARAM, token)
  else url.searchParams.delete(SHARE_PARAM)
  const next = `${url.pathname}${url.search}${url.hash}`
  if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
    history.replaceState(history.state, '', next)
  }
  return url.toString()
}

export function shouldPersistShare(state: ShareState): boolean {
  return state.scenarios.length > 0
}
