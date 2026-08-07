import type { Match, MatchResult, TeamInfo } from '../../types'

/** Deterministische Mini-Liga: 4 Teams, Spieltag 1 fertig, Spieltag 2 offen. */
export const TEAM_ALPHA: TeamInfo = {
  teamId: 1,
  teamName: 'Alpha FC',
  shortName: 'Alpha',
  teamIconUrl: '',
}

export const TEAM_BETA: TeamInfo = {
  teamId: 2,
  teamName: 'Beta United',
  shortName: 'Beta',
  teamIconUrl: '',
}

export const TEAM_GAMMA: TeamInfo = {
  teamId: 3,
  teamName: 'Gamma City',
  shortName: 'Gamma',
  teamIconUrl: '',
}

export const TEAM_DELTA: TeamInfo = {
  teamId: 4,
  teamName: 'Delta SV',
  shortName: 'Delta',
  teamIconUrl: '',
}

function group(day: number) {
  return {
    groupName: `${day}. Spieltag`,
    groupOrderID: day,
    groupID: 1000 + day,
  }
}

function endResult(
  home: number,
  away: number,
  resultOrderID = 2,
): MatchResult {
  return {
    resultID: resultOrderID,
    resultName: 'Endergebnis',
    pointsTeam1: home,
    pointsTeam2: away,
    resultOrderID,
    resultTypeID: 2,
  }
}

function halfTime(home: number, away: number): MatchResult {
  return {
    resultID: 1,
    resultName: 'Halbzeit',
    pointsTeam1: home,
    pointsTeam2: away,
    resultOrderID: 1,
    resultTypeID: 1,
  }
}

function baseMatch(
  partial: Pick<Match, 'matchID' | 'group' | 'team1' | 'team2' | 'matchIsFinished' | 'matchResults'>,
): Match {
  return {
    matchDateTime: '2025-08-01T15:30:00',
    matchDateTimeUTC: '2025-08-01T13:30:00Z',
    leagueName: 'Mini-Liga',
    leagueSeason: 2025,
    leagueShortcut: 'mini',
    lastUpdateDateTime: '2025-08-01T17:00:00',
    goals: [],
    ...partial,
  }
}

/** Spieltag 1 – fertig */
export const MATCH_MD1_ALPHA_BETA = baseMatch({
  matchID: 101,
  group: group(1),
  team1: TEAM_ALPHA,
  team2: TEAM_BETA,
  matchIsFinished: true,
  // Halbzeit weicht ab – finalResult muss Type 2 bevorzugen
  matchResults: [halfTime(0, 0), endResult(2, 1)],
})

export const MATCH_MD1_GAMMA_DELTA = baseMatch({
  matchID: 102,
  group: group(1),
  team1: TEAM_GAMMA,
  team2: TEAM_DELTA,
  matchIsFinished: true,
  matchResults: [endResult(0, 0)],
})

/** Spieltag 2 – offen */
export const MATCH_MD2_ALPHA_GAMMA = baseMatch({
  matchID: 201,
  group: group(2),
  team1: TEAM_ALPHA,
  team2: TEAM_GAMMA,
  matchIsFinished: false,
  matchResults: [],
})

export const MATCH_MD2_BETA_DELTA = baseMatch({
  matchID: 202,
  group: group(2),
  team1: TEAM_BETA,
  team2: TEAM_DELTA,
  matchIsFinished: false,
  matchResults: [],
})

/** Komplette Saison-Fixtures der Mini-Liga */
export const MINI_LEAGUE_MATCHES: Match[] = [
  MATCH_MD1_ALPHA_BETA,
  MATCH_MD1_GAMMA_DELTA,
  MATCH_MD2_ALPHA_GAMMA,
  MATCH_MD2_BETA_DELTA,
]

export const MINI_LEAGUE_FINISHED = MINI_LEAGUE_MATCHES.filter((m) => m.matchIsFinished)
export const MINI_LEAGUE_OPEN = MINI_LEAGUE_MATCHES.filter((m) => !m.matchIsFinished)

/**
 * Nach Spieltag 1 (ohne Szenarien):
 * Alpha 3 Pkt / +1 / 2:1
 * Delta 1 Pkt /  0 / 0:0  (Name vor Gamma)
 * Gamma 1 Pkt /  0 / 0:0
 * Beta  0 Pkt / -1 / 1:2
 */
export const EXPECTED_AFTER_MD1 = [
  { teamId: 1, rank: 1, points: 3, goalDiff: 1, goalsFor: 2, goalsAgainst: 1 },
  { teamId: 4, rank: 2, points: 1, goalDiff: 0, goalsFor: 0, goalsAgainst: 0 },
  { teamId: 3, rank: 3, points: 1, goalDiff: 0, goalsFor: 0, goalsAgainst: 0 },
  { teamId: 2, rank: 4, points: 0, goalDiff: -1, goalsFor: 1, goalsAgainst: 2 },
] as const

/** Match ohne resultTypeID=2 – höchste resultOrderID gewinnt */
export const MATCH_ORDER_FALLBACK: Match = baseMatch({
  matchID: 901,
  group: group(9),
  team1: TEAM_ALPHA,
  team2: TEAM_BETA,
  matchIsFinished: true,
  matchResults: [
    {
      resultID: 10,
      resultName: 'Zwischenstand A',
      pointsTeam1: 0,
      pointsTeam2: 1,
      resultOrderID: 1,
      resultTypeID: 1,
    },
    {
      resultID: 11,
      resultName: 'Zwischenstand B',
      pointsTeam1: 3,
      pointsTeam2: 2,
      resultOrderID: 5,
      resultTypeID: 1,
    },
    {
      resultID: 12,
      resultName: 'Zwischenstand C',
      pointsTeam1: 1,
      pointsTeam2: 1,
      resultOrderID: 3,
      resultTypeID: 1,
    },
  ],
})

export const MATCH_NO_RESULTS: Match = baseMatch({
  matchID: 902,
  group: group(9),
  team1: TEAM_ALPHA,
  team2: TEAM_BETA,
  matchIsFinished: true,
  matchResults: [],
})
