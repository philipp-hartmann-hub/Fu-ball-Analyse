import { describe, expect, it } from 'vitest'
import type { HardRange, Match, StandingRow, TeamInfo } from '../types'
import {
  buildDecisionRadar,
  deriveDecisionStatuses,
  diffDecisionStatuses,
  statusConsistentWithExact,
  triggersBeyondStatus,
} from './decisions'
import { computeExactPositionRanges, computeHardRanges } from './scenarios'

function team(id: number, name: string): TeamInfo {
  return {
    teamId: id,
    teamName: name,
    shortName: name.slice(0, 3),
    teamIconUrl: '',
  }
}

function standingRow(
  partial: Pick<
    StandingRow,
    'teamId' | 'teamName' | 'points' | 'goalDiff' | 'goalsFor' | 'rank'
  > &
    Partial<StandingRow>,
): StandingRow {
  const goalsAgainst =
    partial.goalsAgainst ??
    Math.max(0, (partial.goalsFor ?? 0) - (partial.goalDiff ?? 0))
  return {
    shortName: partial.teamName.slice(0, 3),
    teamIconUrl: '',
    played: 30,
    won: 0,
    draw: 0,
    lost: 0,
    goalsAgainst,
    ...partial,
  }
}

function openMatch(
  matchID: number,
  home: TeamInfo,
  away: TeamInfo,
  day = 31,
): Match {
  return {
    matchID,
    matchDateTime: '2025-04-20T15:30:00',
    matchDateTimeUTC: '2025-04-20T13:30:00Z',
    leagueName: 'Test',
    leagueSeason: 2025,
    leagueShortcut: 'bl1',
    lastUpdateDateTime: '2025-04-20T12:00:00',
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

/** 18er Liga: Fokus weit über dem Abstieg, kann nicht mehr runter. */
function safeFixture() {
  const standings: StandingRow[] = []
  for (let i = 1; i <= 18; i++) {
    if (i === 10) {
      standings.push(
        standingRow({
          teamId: 10,
          teamName: 'Safe FC',
          points: 40,
          goalDiff: 5,
          goalsFor: 40,
          rank: 10,
        }),
      )
    } else if (i >= 16) {
      standings.push(
        standingRow({
          teamId: i,
          teamName: `Low ${i}`,
          points: 20 - (i - 16),
          goalDiff: -20,
          goalsFor: 20,
          rank: i,
        }),
      )
    } else {
      standings.push(
        standingRow({
          teamId: i,
          teamName: `Team ${i}`,
          points: 50 - i,
          goalDiff: 10 - i,
          goalsFor: 45,
          rank: i,
        }),
      )
    }
  }
  // Wenige Restspiele unten: Safe hat 0 Restspiele → hardWorst weit über Abstieg
  const remaining: Match[] = [
    openMatch(1, team(16, 'Low 16'), team(17, 'Low 17')),
    openMatch(2, team(17, 'Low 17'), team(18, 'Low 18')),
  ]
  return { standings, remaining }
}

/** Fokus kann maximal Platz 17 erreichen → abgestiegen. */
function relegatedFixture() {
  const standings: StandingRow[] = []
  for (let i = 1; i <= 18; i++) {
    if (i === 18) {
      standings.push(
        standingRow({
          teamId: 18,
          teamName: 'Doomed',
          points: 10,
          goalDiff: -30,
          goalsFor: 15,
          rank: 18,
        }),
      )
    } else {
      standings.push(
        standingRow({
          teamId: i,
          teamName: `Team ${i}`,
          points: 50 - i,
          goalDiff: 10,
          goalsFor: 40,
          rank: i,
        }),
      )
    }
  }
  // Doomed spielt noch, kann +3 auf 13 — Teams 1–16 haben alle ≥14 und Restspiele
  // → still relegated if others stay above. Simpler: no remaining for anyone,
  // Doomed at 18 with finished season.
  return { standings, remaining: [] as Match[] }
}

/** Platz 1 uneinholbar. */
function championFixture() {
  const standings: StandingRow[] = []
  for (let i = 1; i <= 18; i++) {
    if (i === 1) {
      standings.push(
        standingRow({
          teamId: 1,
          teamName: 'Leader',
          points: 80,
          goalDiff: 50,
          goalsFor: 80,
          rank: 1,
        }),
      )
    } else {
      standings.push(
        standingRow({
          teamId: i,
          teamName: `Team ${i}`,
          points: 50 - i,
          goalDiff: 0,
          goalsFor: 40,
          rank: i,
        }),
      )
    }
  }
  // Zweiter hat zu wenig Restspiele, um Leader einzuholen
  const remaining: Match[] = [
    openMatch(1, team(2, 'Team 2'), team(3, 'Team 3')),
  ]
  return { standings, remaining }
}

describe('deriveDecisionStatuses', () => {
  it('Team rechnerisch gerettet (hardWorst außerhalb Abstieg)', () => {
    const hard: HardRange = { teamId: 10, hardBest: 8, hardWorst: 12 }
    const statuses = deriveDecisionStatuses(hard, 'bl1')
    expect(statuses.some((s) => s.kind === 'safe')).toBe(true)
    expect(statuses.find((s) => s.kind === 'safe')!.shortLabel).toBe('Gerettet')
    expect(statuses.find((s) => s.kind === 'safe')!.label).toBe(
      'Gerettet (Saison steht fest)',
    )
  })

  it('Team rechnerisch abgestiegen (hardBest in Abstiegszone)', () => {
    const hard: HardRange = { teamId: 18, hardBest: 17, hardWorst: 18 }
    const statuses = deriveDecisionStatuses(hard, 'bl1')
    expect(statuses.some((s) => s.kind === 'relegated')).toBe(true)
  })

  it('Meister steht fest (hardWorst == 1)', () => {
    const hard: HardRange = { teamId: 1, hardBest: 1, hardWorst: 1 }
    const statuses = deriveDecisionStatuses(hard, 'bl1')
    expect(statuses.some((s) => s.kind === 'champion')).toBe(true)
    expect(statuses.find((s) => s.kind === 'champion')!.shortLabel).toBe(
      'Meister',
    )
    expect(statuses.find((s) => s.kind === 'champion')!.label).toContain(
      'Saison steht fest',
    )
  })

  it('CL sicher / CL nicht mehr möglich über zoneForRank', () => {
    const secure = deriveDecisionStatuses(
      { teamId: 2, hardBest: 2, hardWorst: 4 },
      'bl1',
    )
    expect(secure.some((s) => s.kind === 'title_secure')).toBe(true)
    expect(secure.find((s) => s.kind === 'title_secure')!.shortLabel).toBe(
      'CL sicher',
    )

    const gone = deriveDecisionStatuses(
      { teamId: 8, hardBest: 5, hardWorst: 10 },
      'bl1',
    )
    expect(gone.some((s) => s.kind === 'title_gone')).toBe(true)
  })
})

describe('buildDecisionRadar / Live-Delta', () => {
  it('Fixture gerettet → Status in Radar', () => {
    const { standings, remaining } = safeFixture()
    const hard = computeHardRanges(standings, remaining)
    const focus = hard.find((h) => h.teamId === 10)!
    expect(focus.hardWorst).toBeLessThan(16)

    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: false,
    })
    const row = radar.all.find((r) => r.teamId === 10)!
    expect(row.confirmedStatuses.some((s) => s.kind === 'safe')).toBe(true)
    expect(row.deltas).toEqual([])
  })

  it('ein Spieltags-Durchlauf füllt Trigger ohne die Statusse zu ändern', () => {
    const { standings, remaining } = safeFixture()
    const without = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: false,
    })
    const withTriggers = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: true,
    })
    for (const row of without.all) {
      const other = withTriggers.all.find((r) => r.teamId === row.teamId)!
      expect(other.confirmedStatuses).toEqual(row.confirmedStatuses)
      expect(other.liveStatuses).toEqual(row.liveStatuses)
    }
  })

  it('Fixture abgestiegen → Status', () => {
    const { standings, remaining } = relegatedFixture()
    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: false,
    })
    const row = radar.all.find((r) => r.teamId === 18)!
    expect(row.confirmedStatuses.some((s) => s.kind === 'relegated')).toBe(true)
  })

  it('Fixture Meister → Status', () => {
    const { standings, remaining } = championFixture()
    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: false,
    })
    const row = radar.all.find((r) => r.teamId === 1)!
    expect(row.confirmedStatuses.some((s) => s.kind === 'champion')).toBe(true)
  })

  it('Live-Delta: bestätigt offen, Live kippt auf gerettet', () => {
    // Bestätigt: Team A bei 33 Pkt., Abstiegsteam bei 32, beide mit Restspiel gegeneinander
    // → A kann noch absteigen. Live: A führt 1:0 → A hat faktisch +3 und ist gerettet.
    const confirmed: StandingRow[] = []
    for (let i = 1; i <= 18; i++) {
      if (i <= 15) {
        confirmed.push(
          standingRow({
            teamId: i,
            teamName: `Top ${i}`,
            points: 50 - i,
            goalDiff: 10,
            goalsFor: 40,
            played: 33,
            rank: i,
          }),
        )
      } else if (i === 16) {
        confirmed.push(
          standingRow({
            teamId: 16,
            teamName: 'Border',
            points: 33,
            goalDiff: 0,
            goalsFor: 30,
            played: 33,
            rank: 16,
          }),
        )
      } else if (i === 17) {
        confirmed.push(
          standingRow({
            teamId: 17,
            teamName: 'Rival',
            points: 32,
            goalDiff: -2,
            goalsFor: 28,
            played: 33,
            rank: 17,
          }),
        )
      } else {
        confirmed.push(
          standingRow({
            teamId: 18,
            teamName: 'Last',
            points: 20,
            goalDiff: -20,
            goalsFor: 20,
            played: 33,
            rank: 18,
          }),
        )
      }
    }
    const remainingConfirmed = [
      openMatch(99, team(16, 'Border'), team(17, 'Rival'), 34),
    ]

    const confHard = computeHardRanges(confirmed, remainingConfirmed)
    const borderConf = confHard.find((h) => h.teamId === 16)!
    // Noch nicht gerettet: kann auf Abstiegsplatz fallen
    expect(borderConf.hardWorst).toBeGreaterThanOrEqual(16)
    expect(
      deriveDecisionStatuses(borderConf, 'bl1').some((s) => s.kind === 'safe'),
    ).toBe(false)

    // Live: Border gewinnt → 36 Pkt., Rival bleibt 32; Last max 20+0
    const live: StandingRow[] = confirmed.map((r) => {
      if (r.teamId === 16) {
        return {
          ...r,
          points: 36,
          won: r.won + 1,
          played: 34,
          rank: 15,
        }
      }
      if (r.teamId === 17) {
        return { ...r, played: 34, lost: r.lost + 1, rank: 17 }
      }
      return { ...r }
    })
    // Re-rank roughly: keep order but 16 is safer
    const remainingLive: Match[] = []

    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: confirmed,
      liveStandings: live,
      remainingConfirmed,
      remainingLive,
      hasLive: true,
      includeTriggers: false,
    })
    const row = radar.all.find((r) => r.teamId === 16)!
    expect(row.liveStatuses.some((s) => s.kind === 'safe')).toBe(true)
    expect(row.deltas.some((d) => d.kind === 'gained' && d.status.kind === 'safe')).toBe(
      true,
    )

    const noLive = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: confirmed,
      liveStandings: confirmed,
      remainingConfirmed,
      remainingLive: remainingConfirmed,
      hasLive: false,
      includeTriggers: false,
    })
    expect(noLive.all.find((r) => r.teamId === 16)!.deltas).toEqual([])
  })

  it('ohne laufendes Spiel kein Delta', () => {
    const a = deriveDecisionStatuses(
      { teamId: 1, hardBest: 1, hardWorst: 1 },
      'bl1',
    )
    const b = deriveDecisionStatuses(
      { teamId: 1, hardBest: 1, hardWorst: 2 },
      'bl1',
    )
    // Diff würde gained/lost finden — Radar unterdrückt ohne hasLive
    expect(diffDecisionStatuses(b, a).length).toBeGreaterThan(0)
    const { standings, remaining } = championFixture()
    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: false,
    })
    expect(radar.all.every((r) => r.deltas.length === 0)).toBe(true)
  })
})

describe('Konsistenz Status vs. Exact', () => {
  it('feststehender Status kollidiert nie mit Exact-Spanne', () => {
    const standings: StandingRow[] = []
    for (let i = 1; i <= 18; i++) {
      standings.push(
        standingRow({
          teamId: i,
          teamName: `T${i}`,
          points: i <= 13 ? 60 - i : i === 14 ? 32 : i === 15 ? 32 : 20 - (i - 15),
          goalDiff: i <= 13 ? 20 - i : i === 14 ? 5 : i === 15 ? 0 : -10,
          goalsFor: 40,
          played: 33,
          rank: i,
        }),
      )
    }
    const remaining = [
      openMatch(3401, team(14, 'Köln'), team(15, 'Bremen'), 34),
    ]
    const hard = computeHardRanges(standings, remaining)
    const exact = computeExactPositionRanges(standings, remaining)!
    for (const h of hard) {
      const e = exact.find((r) => r.teamId === h.teamId)!
      expect(statusConsistentWithExact(h, e, 'bl1')).toBe(true)
    }
  })
})

describe('triggersBeyondStatus', () => {
  const safe = {
    kind: 'safe' as const,
    shortLabel: 'Gerettet',
    label: 'Gerettet (Saison steht fest)',
    tone: 'good' as const,
  }
  const relegated = {
    kind: 'relegated' as const,
    shortLabel: 'Abgestiegen',
    label: 'Abgestiegen (Saison steht fest)',
    tone: 'bad' as const,
  }

  it('blendet Status-Doppelungen aus, behält zusätzliche Schwellen', () => {
    const leftover = triggersBeyondStatus(
      [safe],
      [
        {
          key: 'survive-safe',
          label: 'Klassenerhalt',
          primary: 'sicher',
          tone: 'good',
        },
        {
          key: 'target-possible-from',
          label: 'CL möglich',
          primary: 'ab 58',
          tone: 'neutral',
        },
      ],
    )
    expect(leftover.map((l) => l.key)).toEqual(['target-possible-from'])
  })

  it('blendet Abstieg-sicher aus, wenn Status bereits abgestiegen', () => {
    const leftover = triggersBeyondStatus(
      [relegated],
      [
        {
          key: 'releg-certain',
          label: 'Abstieg',
          primary: 'sicher',
          tone: 'bad',
        },
        {
          key: 'target-gone',
          label: 'CL',
          primary: 'nicht mehr möglich',
          tone: 'bad',
        },
      ],
    )
    expect(leftover.map((l) => l.key)).toEqual(['target-gone'])
  })

  it('lässt alle Zeilen, wenn kein Status feststeht', () => {
    const lines = [
      {
        key: 'survive-from',
        label: 'Klassenerhalt',
        primary: 'ab 40',
        tone: 'good' as const,
      },
    ]
    expect(triggersBeyondStatus([], lines)).toEqual(lines)
  })
})
