import { z } from 'zod'

/**
 * Runtime-Schemas für OpenLigaDB-Matchdaten.
 * Nur genutzte Felder streng; unbekannte Keys werden toleriert (.passthrough()).
 */

const teamInfoSchema = z
  .object({
    teamId: z.number(),
    teamName: z.string(),
    shortName: z.string().nullish().transform((v) => v ?? ''),
    teamIconUrl: z.string().nullish().transform((v) => v ?? ''),
  })
  .passthrough()

const matchGroupSchema = z
  .object({
    groupName: z.string().nullish().transform((v) => v ?? ''),
    groupOrderID: z.number(),
    groupID: z.number().nullish().transform((v) => v ?? 0),
  })
  .passthrough()

const matchResultSchema = z
  .object({
    resultID: z.number().nullish().transform((v) => v ?? 0),
    resultName: z.string().nullish().transform((v) => v ?? ''),
    pointsTeam1: z.number(),
    pointsTeam2: z.number(),
    resultOrderID: z.number(),
    resultTypeID: z.number(),
  })
  .passthrough()

export const matchSchema = z
  .object({
    matchID: z.number(),
    matchDateTime: z.string().nullish().transform((v) => v ?? ''),
    matchDateTimeUTC: z.string().nullish().transform((v) => v ?? ''),
    leagueName: z.string().nullish().transform((v) => v ?? ''),
    leagueSeason: z.number().nullish().transform((v) => v ?? 0),
    leagueShortcut: z.string().nullish().transform((v) => v ?? ''),
    group: matchGroupSchema,
    team1: teamInfoSchema,
    team2: teamInfoSchema,
    matchIsFinished: z.boolean(),
    matchResults: z.array(matchResultSchema).nullish().transform((v) => v ?? []),
    lastUpdateDateTime: z.string().nullish().transform((v) => v ?? ''),
  })
  .passthrough()

export const matchesResponseSchema = z.array(matchSchema)

export type TeamInfo = z.infer<typeof teamInfoSchema>
export type MatchGroup = z.infer<typeof matchGroupSchema>
export type MatchResult = z.infer<typeof matchResultSchema>
export type Match = z.infer<typeof matchSchema>

/** Lesbare Fehlermeldung inkl. Index/Feldpfad für UI / useLeagueData. */
export function formatOpenLigaParseError(error: z.ZodError): string {
  const parts = error.issues.slice(0, 8).map((issue) => {
    const path =
      issue.path.length === 0
        ? '(root)'
        : issue.path
            .map((p) => (typeof p === 'number' ? `[${p}]` : p))
            .join('.')
            .replace(/\.\[/g, '[')
    return `${path}: ${issue.message}`
  })
  const more =
    error.issues.length > 8 ? ` (+${error.issues.length - 8} weitere)` : ''
  return `OpenLigaDB-Antwort ungültig (${error.issues.length} Fehler${more}). ${parts.join('; ')}`
}

/**
 * Validiert die Roh-JSON-Antwort von getmatchdata.
 * Wirft Error mit sprechender Meldung (Feld/Index) — landet im Error-State.
 */
export function parseMatchesResponse(data: unknown): Match[] {
  const parsed = matchesResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(formatOpenLigaParseError(parsed.error))
  }
  return parsed.data
}
