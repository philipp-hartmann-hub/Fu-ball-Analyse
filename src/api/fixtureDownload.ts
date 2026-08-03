import { z } from 'zod'
import type { Match } from '../types'

/**
 * fixturedownload.com — öffentliche Saison-JSON-Feeds, kein API-Token.
 * @see https://fixturedownload.com/
 */

const fxMatchSchema = z
  .object({
    MatchNumber: z.number(),
    RoundNumber: z.number(),
    DateUtc: z.string(),
    HomeTeam: z.string(),
    AwayTeam: z.string(),
    HomeTeamScore: z.number().nullable(),
    AwayTeamScore: z.number().nullable(),
  })
  .passthrough()

export const fxMatchesSchema = z.array(fxMatchSchema)

export type FxMatch = z.infer<typeof fxMatchSchema>

/** Stabile numerische Team-ID aus dem Namen (keine IDs im Feed). */
export function teamIdFromName(name: string): number {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 1_000_000 + (h >>> 0) % 8_000_000
}

function toIsoUtc(dateUtc: string): string {
  // Feed: "2025-08-15 19:00:00Z" → ISO
  const trimmed = dateUtc.trim()
  if (trimmed.includes('T')) return trimmed
  return trimmed.replace(' ', 'T')
}

function teamLabel(name: string) {
  return {
    teamId: teamIdFromName(name),
    teamName: name,
    shortName: name,
    teamIconUrl: '',
  }
}

export function mapFxMatchToMatch(
  m: FxMatch,
  meta: { leagueName: string; leagueSeason: number; leagueShortcut: string },
): Match {
  const matchday = m.RoundNumber > 0 ? m.RoundNumber : 1
  const finished =
    typeof m.HomeTeamScore === 'number' && typeof m.AwayTeamScore === 'number'
  const iso = toIsoUtc(m.DateUtc)
  // Eindeutig je Liga+Saison: Shortcut-Hash * 1e6 + MatchNumber
  const leagueSalt = teamIdFromName(meta.leagueShortcut) % 900
  const matchID = leagueSalt * 1_000_000 + m.MatchNumber

  const matchResults: Match['matchResults'] = []
  if (finished) {
    matchResults.push({
      resultID: 2,
      resultName: 'Endergebnis',
      pointsTeam1: m.HomeTeamScore!,
      pointsTeam2: m.AwayTeamScore!,
      resultOrderID: 2,
      resultTypeID: 2,
    })
  }

  return {
    matchID,
    matchDateTime: iso,
    matchDateTimeUTC: iso,
    leagueName: meta.leagueName,
    leagueSeason: meta.leagueSeason,
    leagueShortcut: meta.leagueShortcut,
    group: {
      groupName: `${matchday}. Spieltag`,
      groupOrderID: matchday,
      groupID: matchday,
    },
    team1: teamLabel(m.HomeTeam),
    team2: teamLabel(m.AwayTeam),
    matchIsFinished: finished,
    matchResults,
    lastUpdateDateTime: iso,
  }
}

export function formatFxParseError(error: z.ZodError): string {
  const parts = error.issues.slice(0, 6).map((issue) => {
    const path =
      issue.path.length === 0
        ? '(root)'
        : issue.path
            .map((p) => (typeof p === 'number' ? `[${p}]` : p))
            .join('.')
            .replace(/\.\[/g, '[')
    return `${path}: ${issue.message}`
  })
  return `fixturedownload-Antwort ungültig. ${parts.join('; ')}`
}

export function parseFxMatchesResponse(
  data: unknown,
  meta: { leagueName: string; leagueSeason: number; leagueShortcut: string },
): Match[] {
  const parsed = fxMatchesSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(formatFxParseError(parsed.error))
  }
  return parsed.data
    .filter((m) => m.RoundNumber > 0)
    .map((m) => mapFxMatchToMatch(m, meta))
    .sort(
      (a, b) =>
        a.group.groupOrderID - b.group.groupOrderID || a.matchID - b.matchID,
    )
}

const FX_BASE = '/api/fixtures'

/**
 * Lädt die Saison-JSON einer Liga (kein Token).
 * season = Startjahr (2025 → Feed `…-2025` = Saison 2025/26).
 */
export async function fetchFixtureDownloadMatches(
  feedSlug: string,
  season: number,
  meta: { leagueName: string; leagueShortcut: string },
): Promise<Match[]> {
  const url = `${FX_BASE}/${encodeURIComponent(feedSlug)}-${season}`
  const res = await fetch(url)
  if (res.status === 404) {
    throw new Error(
      `Keine Fixtures für ${meta.leagueName} ${season}/${season + 1} (Feed nicht gefunden).`,
    )
  }
  if (!res.ok) {
    throw new Error(
      `fixturedownload.com ${res.status}: ${feedSlug}-${season}`,
    )
  }
  const raw: unknown = await res.json()
  return parseFxMatchesResponse(raw, {
    leagueName: meta.leagueName,
    leagueSeason: season,
    leagueShortcut: meta.leagueShortcut,
  })
}
