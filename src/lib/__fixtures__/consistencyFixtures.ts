import type { Match, StandingRow, TeamInfo } from '../../types'

/** Gemeinsame Fixtures für modulübergreifende Konsistenztests. */

export function teamInfo(id: number, name: string): TeamInfo {
  return {
    teamId: id,
    teamName: name,
    shortName: name.slice(0, 3).toUpperCase(),
    teamIconUrl: '',
  }
}

export function standingRow(
  partial: Partial<StandingRow> &
    Pick<StandingRow, 'teamId' | 'teamName' | 'points' | 'rank'>,
): StandingRow {
  const played = partial.played ?? 20
  const gf = partial.goalsFor ?? Math.max(0, 30 - partial.rank)
  const ga = partial.goalsAgainst ?? Math.max(0, partial.rank)
  return {
    teamId: partial.teamId,
    teamName: partial.teamName,
    shortName: partial.shortName ?? partial.teamName.slice(0, 3),
    teamIconUrl: '',
    played,
    won: partial.won ?? 0,
    draw: partial.draw ?? 0,
    lost: partial.lost ?? 0,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDiff: partial.goalDiff ?? gf - ga,
    points: partial.points,
    rank: partial.rank,
  }
}

export function openMatch(
  matchID: number,
  home: TeamInfo,
  away: TeamInfo,
  day = 30,
): Match {
  return {
    matchID,
    matchDateTime: '2025-04-01T15:30:00',
    matchDateTimeUTC: '2025-04-01T13:30:00Z',
    leagueName: 'Bundesliga',
    leagueSeason: 2025,
    leagueShortcut: 'bl1',
    lastUpdateDateTime: '2025-04-01T17:00:00',
    group: {
      groupName: `${day}. Spieltag`,
      groupOrderID: day,
      groupID: 1000 + day,
    },
    team1: home,
    team2: away,
    matchIsFinished: false,
    matchResults: [],
    goals: [],
  }
}

export function finishedMatch(
  matchID: number,
  day: number,
  home: TeamInfo,
  away: TeamInfo,
  homeGoals: number,
  awayGoals: number,
): Match {
  return {
    matchID,
    matchDateTime: `2025-09-${String(Math.min(28, day)).padStart(2, '0')}T15:30:00`,
    matchDateTimeUTC: `2025-09-${String(Math.min(28, day)).padStart(2, '0')}T13:30:00Z`,
    leagueName: 'Bundesliga',
    leagueSeason: 2025,
    leagueShortcut: 'bl1',
    lastUpdateDateTime: '2025-09-01T17:00:00',
    group: {
      groupName: `${day}. Spieltag`,
      groupOrderID: day,
      groupID: 1000 + day,
    },
    team1: home,
    team2: away,
    matchIsFinished: true,
    matchResults: [
      {
        resultID: 2,
        resultName: 'Endergebnis',
        pointsTeam1: homeGoals,
        pointsTeam2: awayGoals,
        resultOrderID: 2,
        resultTypeID: 2,
      },
    ],
    goals: [],
  }
}

/** Einfacher Round-Robin (Kreisverfahren) für `n` Teams, `matchdays` Spieltage. */
function roundRobinSchedule(
  teams: TeamInfo[],
  matchdays: number,
  matchIdStart = 1000,
): Match[] {
  const n = teams.length
  if (n % 2 !== 0) throw new Error('gerade Teamzahl erwartet')
  const order = [...teams]
  const remaining: Match[] = []
  let matchId = matchIdStart
  for (let day = 1; day <= matchdays; day++) {
    for (let i = 0; i < n / 2; i++) {
      const home = order[i]!
      const away = order[n - 1 - i]!
      remaining.push(openMatch(matchId++, home, away, day))
    }
    // rotiere (erster Index fix)
    const last = order.pop()!
    order.splice(1, 0, last)
  }
  return remaining
}

/** 18 Teams, 0 Spiele — Saisonstart (Reliabilität / keine Clinch-Sprache). */
export function zeroGamesBl1Fixture(): {
  standings: StandingRow[]
  remaining: Match[]
  played: Match[]
} {
  const teams = Array.from({ length: 18 }, (_, i) =>
    teamInfo(i + 1, `Team ${i + 1}`),
  )
  const standings = teams.map((t, i) =>
    standingRow({
      teamId: t.teamId,
      teamName: t.teamName,
      shortName: t.shortName,
      points: 0,
      goalDiff: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      played: 0,
      rank: i + 1,
    }),
  )
  // Volle Hinrunde (17 Spieltage) — Spanne 1.–18., nichts entschieden
  return {
    standings,
    remaining: roundRobinSchedule(teams, 17),
    played: [],
  }
}

/**
 * Frühphase nach 2 Spieltagen: noch keine Saison-Entscheidung,
 * Median `played` unter MIN_GAMES → modellbasiert „noch keine Aussage“.
 */
export function twoGamesBl1Fixture(): {
  standings: StandingRow[]
  remaining: Match[]
  played: Match[]
} {
  const teams = Array.from({ length: 18 }, (_, i) =>
    teamInfo(i + 1, `Team ${i + 1}`),
  )
  const played = roundRobinSchedule(teams, 2, 1).map((m, idx) => {
    const day = m.group.groupOrderID
    const hg = idx % 3 === 0 ? 1 : idx % 3 === 1 ? 2 : 0
    const ag = idx % 3 === 0 ? 1 : idx % 3 === 1 ? 0 : 1
    return finishedMatch(
      m.matchID,
      day,
      m.team1,
      m.team2,
      hg,
      ag,
    )
  })

  // Grobe Tabelle aus den 2 Spieltagen (nur für Fixture-Konsistenz)
  const pts = new Map<number, number>()
  const gf = new Map<number, number>()
  const ga = new Map<number, number>()
  for (const t of teams) {
    pts.set(t.teamId, 0)
    gf.set(t.teamId, 0)
    ga.set(t.teamId, 0)
  }
  for (const m of played) {
    const r = m.matchResults[0]!
    gf.set(m.team1.teamId, (gf.get(m.team1.teamId) ?? 0) + r.pointsTeam1)
    ga.set(m.team1.teamId, (ga.get(m.team1.teamId) ?? 0) + r.pointsTeam2)
    gf.set(m.team2.teamId, (gf.get(m.team2.teamId) ?? 0) + r.pointsTeam2)
    ga.set(m.team2.teamId, (ga.get(m.team2.teamId) ?? 0) + r.pointsTeam1)
    if (r.pointsTeam1 > r.pointsTeam2) {
      pts.set(m.team1.teamId, (pts.get(m.team1.teamId) ?? 0) + 3)
    } else if (r.pointsTeam1 < r.pointsTeam2) {
      pts.set(m.team2.teamId, (pts.get(m.team2.teamId) ?? 0) + 3)
    } else {
      pts.set(m.team1.teamId, (pts.get(m.team1.teamId) ?? 0) + 1)
      pts.set(m.team2.teamId, (pts.get(m.team2.teamId) ?? 0) + 1)
    }
  }
  const ranked = [...teams].sort((a, b) => {
    const pd = (pts.get(b.teamId) ?? 0) - (pts.get(a.teamId) ?? 0)
    if (pd !== 0) return pd
    const gda =
      (gf.get(b.teamId) ?? 0) -
      (ga.get(b.teamId) ?? 0) -
      ((gf.get(a.teamId) ?? 0) - (ga.get(a.teamId) ?? 0))
    return gda
  })
  const standings = ranked.map((t, i) => {
    const gFor = gf.get(t.teamId) ?? 0
    const gAgainst = ga.get(t.teamId) ?? 0
    return standingRow({
      teamId: t.teamId,
      teamName: t.teamName,
      shortName: t.shortName,
      points: pts.get(t.teamId) ?? 0,
      goalsFor: gFor,
      goalsAgainst: gAgainst,
      goalDiff: gFor - gAgainst,
      played: 2,
      rank: i + 1,
    })
  })
  return {
    standings,
    remaining: roundRobinSchedule(teams, 15, 2000),
    played,
  }
}

/**
 * Mid-Season BL1: klare Hierarchie, wenige Restspiele (Exact möglich),
 * inkl. Köln/Bremen-Duell und schwachem Schlusslicht vs. Top.
 */
export function midSeasonBl1Fixture(): {
  standings: StandingRow[]
  remaining: Match[]
  played: Match[]
  koeId: number
  breId: number
  weakId: number
} {
  const standings: StandingRow[] = []
  for (let i = 1; i <= 18; i++) {
    if (i <= 13) {
      standings.push(
        standingRow({
          teamId: i,
          teamName: `Team ${i}`,
          points: 60 - i,
          goalDiff: 20 - i,
          goalsFor: 45 - i,
          goalsAgainst: 10 + i,
          played: 28,
          rank: i,
        }),
      )
    } else if (i === 14) {
      standings.push(
        standingRow({
          teamId: 14,
          teamName: 'Köln',
          shortName: 'KOE',
          points: 32,
          goalDiff: 5,
          goalsFor: 40,
          goalsAgainst: 35,
          played: 28,
          rank: 14,
        }),
      )
    } else if (i === 15) {
      standings.push(
        standingRow({
          teamId: 15,
          teamName: 'Bremen',
          shortName: 'BRE',
          points: 32,
          goalDiff: 0,
          goalsFor: 35,
          goalsAgainst: 35,
          played: 28,
          rank: 15,
        }),
      )
    } else {
      standings.push(
        standingRow({
          teamId: i,
          teamName: i === 18 ? 'Schlusslicht' : `Team ${i}`,
          shortName: i === 18 ? 'SL' : `T${i}`,
          points: 20 - (i - 15),
          goalDiff: -10 - (i - 15),
          goalsFor: 18,
          goalsAgainst: 40 + (i - 15),
          played: 28,
          rank: i,
        }),
      )
    }
  }

  const koe = teamInfo(14, 'Köln')
  const bre = teamInfo(15, 'Bremen')
  const weak = teamInfo(18, 'Schlusslicht')
  const top1 = teamInfo(1, 'Team 1')
  const top2 = teamInfo(2, 'Team 2')
  const top3 = teamInfo(3, 'Team 3')
  const mid = teamInfo(10, 'Team 10')

  const remaining = [
    openMatch(3401, koe, bre, 34),
    openMatch(3402, weak, top1, 34),
    openMatch(3403, top2, weak, 34),
    openMatch(3404, weak, top3, 34),
    openMatch(3405, mid, weak, 34),
  ]

  // Genug Finished für Strength/Trend (nicht exakt Tabellen-konsistent, nur Modell-Input)
  const played: Match[] = []
  let matchId = 1
  for (let day = 1; day <= 5; day++) {
    for (let i = 0; i < 9; i++) {
      const h = teamInfo(i * 2 + 1, `Team ${i * 2 + 1}`)
      const a = teamInfo(i * 2 + 2, `Team ${i * 2 + 2}`)
      const hg = i < 3 ? 2 : 1
      const ag = i < 3 ? 0 : 1
      played.push(finishedMatch(matchId++, day, h, a, hg, ag))
    }
  }

  return {
    standings,
    remaining,
    played,
    koeId: 14,
    breId: 15,
    weakId: 18,
  }
}

/** Schwaches Team vs. Top-Gegner (Köln-Härte-Fall). */
export function weakVsStrongRestFixture(): {
  standings: StandingRow[]
  remaining: Match[]
  focusId: number
} {
  const played = 20
  const koeln = teamInfo(18, 'Köln')
  const strongA = teamInfo(1, 'Bayern')
  const strongB = teamInfo(2, 'Dortmund')
  const strongC = teamInfo(3, 'Leipzig')
  const mid = teamInfo(10, 'Freiburg')
  const standings: StandingRow[] = [
    standingRow({
      teamId: 1,
      teamName: 'Bayern',
      points: 50,
      goalsFor: 55,
      goalsAgainst: 12,
      played,
      rank: 1,
    }),
    standingRow({
      teamId: 2,
      teamName: 'Dortmund',
      points: 45,
      goalsFor: 48,
      goalsAgainst: 18,
      played,
      rank: 2,
    }),
    standingRow({
      teamId: 3,
      teamName: 'Leipzig',
      points: 42,
      goalsFor: 44,
      goalsAgainst: 20,
      played,
      rank: 3,
    }),
    standingRow({
      teamId: 10,
      teamName: 'Freiburg',
      points: 28,
      goalsFor: 28,
      goalsAgainst: 28,
      played,
      rank: 10,
    }),
    standingRow({
      teamId: 18,
      teamName: 'Köln',
      points: 8,
      goalsFor: 12,
      goalsAgainst: 48,
      played,
      rank: 18,
    }),
  ]
  const remaining = [
    openMatch(1, koeln, strongA, 30),
    openMatch(2, strongB, koeln, 31),
    openMatch(3, koeln, strongC, 32),
    openMatch(4, mid, koeln, 33),
  ]
  return { standings, remaining, focusId: 18 }
}
