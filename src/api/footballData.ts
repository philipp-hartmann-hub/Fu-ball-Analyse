import type { Match } from '../types'

const FD_BASE = import.meta.env.DEV
  ? '/api/fd'
  : 'https://api.football-data.org/v4'

interface FdTeam {
  id: number
  name: string
  shortName?: string | null
  tla?: string | null
  crest?: string | null
}

interface FdMatch {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  homeTeam: FdTeam
  awayTeam: FdTeam
  score: {
    fullTime?: { home: number | null; away: number | null }
  }
  competition?: { name?: string; code?: string }
}

interface FdMatchesResponse {
  matches: FdMatch[]
}

function authHeaders(): HeadersInit {
  const token = import.meta.env.VITE_FOOTBALL_DATA_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'Für Premier League, La Liga, Serie A, Ligue 1 und UEFA-Wettbewerbe brauchst du einen kostenlosen football-data.org Token (VITE_FOOTBALL_DATA_TOKEN in .env).',
    )
  }
  return { 'X-Auth-Token': token }
}

export async function fetchFootballDataMatches(
  code: string,
  season: number,
): Promise<Match[]> {
  const res = await fetch(
    `${FD_BASE}/competitions/${encodeURIComponent(code)}/matches?season=${season}`,
    { headers: authHeaders() },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`football-data.org ${res.status}: ${body || code}`)
  }
  const data = (await res.json()) as FdMatchesResponse
  return (data.matches ?? []).map(normalizeMatch)
}

function normalizeMatch(m: FdMatch): Match {
  const finished = m.status === 'FINISHED'
  const home = m.score.fullTime?.home
  const away = m.score.fullTime?.away
  const matchday = m.matchday ?? 0

  return {
    matchID: m.id,
    matchDateTime: m.utcDate,
    matchDateTimeUTC: m.utcDate,
    leagueName: m.competition?.name ?? m.competition?.code ?? 'Competition',
    leagueSeason: Number(m.utcDate.slice(0, 4)),
    leagueShortcut: m.competition?.code ?? '',
    group: {
      groupName: matchday ? `${matchday}. Spieltag` : 'Spieltag',
      groupOrderID: matchday || 1,
      groupID: matchday || 1,
    },
    team1: {
      teamId: m.homeTeam.id,
      teamName: m.homeTeam.name,
      shortName: m.homeTeam.shortName || m.homeTeam.tla || m.homeTeam.name,
      teamIconUrl: m.homeTeam.crest || '',
    },
    team2: {
      teamId: m.awayTeam.id,
      teamName: m.awayTeam.name,
      shortName: m.awayTeam.shortName || m.awayTeam.tla || m.awayTeam.name,
      teamIconUrl: m.awayTeam.crest || '',
    },
    matchIsFinished: finished,
    matchResults:
      finished && home != null && away != null
        ? [
            {
              resultID: m.id,
              resultName: 'Endergebnis',
              pointsTeam1: home,
              pointsTeam2: away,
              resultOrderID: 2,
              resultTypeID: 2,
            },
          ]
        : [],
    lastUpdateDateTime: m.utcDate,
  }
}
