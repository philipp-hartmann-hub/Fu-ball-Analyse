import { describe, expect, it } from 'vitest'
import type { HardRange, Match, StandingRow, TeamInfo } from '../types'
import {
  buildDecisionRadar,
  deriveDecisionStatuses,
  deriveMatchdayPositionLines,
  diffDecisionStatuses,
  filterMatchdayTriggersBySeasonHard,
  matchdayCanSecureTarget,
  seasonFateStillOpen,
  statusConsistentWithExact,
  triggersBeyondStatus,
} from './decisions'
import { computeExactPositionRanges, computeHardRanges } from './scenarios'
import { isRelegationRank, isTopTargetRank } from './thresholds'

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

/** Saisonanfang: jeder kann noch 1. und letzter werden. */
function earlySeasonFixture() {
  const standings: StandingRow[] = []
  for (let i = 1; i <= 18; i++) {
    standings.push(
      standingRow({
        teamId: i,
        teamName: `Team ${i}`,
        points: i <= 3 ? 3 : i <= 9 ? 1 : 0,
        goalDiff: 4 - i,
        goalsFor: 3,
        played: 1,
        rank: i,
      }),
    )
  }
  const remaining: Match[] = []
  let id = 100
  for (let day = 2; day <= 34; day++) {
    for (let k = 0; k < 9; k++) {
      const a = k * 2 + 1
      const b = k * 2 + 2
      remaining.push(openMatch(id++, team(a, `Team ${a}`), team(b, `Team ${b}`), day))
    }
  }
  return { standings, remaining }
}

/**
 * Vorletzter Spieltag BL2: Team 1 kann Aufstieg diesen Spieltag hart sichern
 * (+3 → hardWorst ≤ 2), Spanne vorher noch offen (hardBest in Top-2, hardWorst nicht).
 */
function lateSeasonPromotionClinchFixture() {
  const focusId = 1
  const standings: StandingRow[] = []
  // Team 1: 50 Pkt., Team 2: 55 (sicher darüber), 3–18: 49 Pkt. mit je 1 Restspiel
  standings.push(
    standingRow({
      teamId: 1,
      teamName: 'Leader',
      points: 50,
      goalDiff: 20,
      goalsFor: 60,
      played: 33,
      rank: 2,
    }),
  )
  standings.push(
    standingRow({
      teamId: 2,
      teamName: 'Top',
      points: 55,
      goalDiff: 25,
      goalsFor: 65,
      played: 33,
      rank: 1,
    }),
  )
  for (let i = 3; i <= 18; i++) {
    standings.push(
      standingRow({
        teamId: i,
        teamName: `Pack ${i}`,
        points: 49,
        goalDiff: 10 - i,
        goalsFor: 40,
        played: 33,
        rank: i,
      }),
    )
  }
  // ST 34: alle 18 Teams — Leader gegen Pack 3, Rest paaren
  const remaining: Match[] = [
    openMatch(1, team(1, 'Leader'), team(3, 'Pack 3'), 34),
    openMatch(2, team(2, 'Top'), team(4, 'Pack 4'), 34),
  ]
  let id = 10
  for (let i = 5; i <= 18; i += 2) {
    remaining.push(
      openMatch(
        id++,
        team(i, `Pack ${i}`),
        team(i + 1, `Pack ${i + 1}`),
        34,
      ),
    )
  }
  return { standings, remaining, focusId }
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

  it('2. Spieltag: Saison leer, Spieltag mit Positions-Aussagen ohne Clinch-Sprache', () => {
    const { standings, remaining } = earlySeasonFixture()
    const hard = computeHardRanges(standings, remaining)
    expect(hard.every((h) => seasonFateStillOpen(h, 'bl2'))).toBe(true)

    const radar = buildDecisionRadar({
      league: 'bl2',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: true,
      nowMs: Date.parse('2026-08-14T12:00:00Z'),
    })
    expect(radar.showMatchdayHorizon).toBe(true)
    expect(radar.decided).toEqual([])
    expect(radar.all.every((r) => r.seasonTriggers.length === 0)).toBe(true)
    expect(radar.all.some((r) => r.matchdayTriggers.length > 0)).toBe(true)
    for (const row of radar.all) {
      expect(row.confirmedStatuses).toEqual([])
      const mdBlob = row.matchdayTriggers
        .map((t) => `${t.label} ${t.primary}`)
        .join(' ')
      expect(mdBlob).not.toMatch(/nicht mehr erreichbar/)
      expect(mdBlob).not.toMatch(/Klassenerhalt/)
      expect(mdBlob).not.toMatch(/Aufstieg sicher/)
      expect(mdBlob).not.toMatch(/kann auf Platz|Platz \d+–\d+|bleibt Platz/)
      if (row.matchdayTriggers.length > 0) {
        expect(mdBlob).toMatch(
          /Tabellenführer|Aufstiegsplatz|Relegationsplatz|Abstiegsplatz|CL-Platz|EL-Platz|ECL-Platz/,
        )
      }
    }
  })

  it('2. Spieltag mit Live: Spieltags-Ebene zeigt Zwischenstand-Delta', () => {
    const { standings, remaining } = earlySeasonFixture()
    const live = standings.map((r) =>
      r.teamId === 2
        ? { ...r, points: r.points + 3, rank: 1, won: r.won + 1, played: r.played + 1 }
        : r.teamId === 1
          ? { ...r, rank: 2 }
          : r,
    )
    // Ranks neu setzen grob: Team 2 führt
    live.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff)
    live.forEach((r, i) => {
      r.rank = i + 1
    })

    const radar = buildDecisionRadar({
      league: 'bl2',
      confirmedStandings: standings,
      liveStandings: live,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: true,
      includeTriggers: true,
      nowMs: Date.parse('2026-08-14T12:00:00Z'),
    })
    const row = radar.all.find((r) => r.teamId === 2)!
    expect(row.matchdayTriggers.some((t) => t.key === 'live-leader')).toBe(true)
    expect(row.matchdayTriggers.map((t) => t.primary).join(' ')).toMatch(
      /Tabellenführer/,
    )
  })

  it('vorletzter Spieltag: Saison-Clinch und Spieltags-Position getrennt, konsistent', () => {
    const { standings, remaining, focusId } = lateSeasonPromotionClinchFixture()
    const hard = computeHardRanges(standings, remaining)
    const focusHard = hard.find((h) => h.teamId === focusId)!
    expect(isTopTargetRank(focusHard.hardBest, 'bl2')).toBe(true)
    expect(isTopTargetRank(focusHard.hardWorst, 'bl2')).toBe(false)
    expect(
      matchdayCanSecureTarget(standings, remaining, 34, focusId, 'bl2'),
    ).toBe(true)

    const radar = buildDecisionRadar({
      league: 'bl2',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: true,
      nowMs: Date.parse('2025-04-20T12:00:00Z'),
    })
    const row = radar.all.find((r) => r.teamId === focusId)!
    // Bereits Aufstiegsplatz: Spieltag nur bei Tabellenführer/Zone-Wechsel
    for (const t of row.matchdayTriggers) {
      expect(`${t.label} ${t.primary}`).toMatch(
        /Tabellenführer|Aufstiegsplatz|Relegationsplatz|Abstiegsplatz|CL-Platz|EL-Platz|ECL-Platz/,
      )
      expect(t.primary).not.toMatch(/kann auf Platz|Platz \d+–\d+/)
    }

    expect(
      row.seasonTriggers.some((t) =>
        ['target-safe', 'target-secure-from', 'target-possible-from'].includes(
          t.key,
        ),
      ),
    ).toBe(true)
    const seasonBlob = row.seasonTriggers.map((t) => `${t.label} ${t.primary}`).join(' ')
    expect(seasonBlob).toMatch(/Aufstieg/)
    expect(seasonBlob).not.toMatch(/Nach diesem Spieltag/)

    for (const teamRow of radar.all) {
      const h = hard.find((x) => x.teamId === teamRow.teamId)!
      for (const line of teamRow.seasonTriggers) {
        if (line.key === 'target-gone') {
          expect(isTopTargetRank(h.hardBest, 'bl2')).toBe(false)
        }
        if (line.key === 'survive-safe') {
          expect(isRelegationRank(h.hardWorst, 'bl2')).toBe(false)
        }
        if (line.key === 'target-safe') {
          expect(isTopTargetRank(h.hardWorst, 'bl2')).toBe(true)
        }
        if (
          line.key === 'target-secure-from' ||
          line.key === 'target-possible-from'
        ) {
          expect(isTopTargetRank(h.hardBest, 'bl2')).toBe(true)
          expect(isTopTargetRank(h.hardWorst, 'bl2')).toBe(false)
        }
      }
    }
  })

  it('filterMatchdayTriggersBySeasonHard: keine Zeile gegen offene Saison-Spanne', () => {
    const open: HardRange = { teamId: 1, hardBest: 1, hardWorst: 18 }
    const lines = [
      {
        key: 'target-gone',
        label: 'Aufstieg',
        primary: 'nicht mehr erreichbar',
        tone: 'bad' as const,
      },
      {
        key: 'survive-safe',
        label: 'Klassenerhalt',
        primary: 'rechnerisch sicher',
        tone: 'good' as const,
      },
      {
        key: 'target-secure-from',
        label: 'Aufstieg sicher ab',
        primary: '5 Pkt.',
        tone: 'good' as const,
      },
    ]
    expect(
      filterMatchdayTriggersBySeasonHard(lines, open, 'bl2', {
        canSecureTarget: false,
        canEliminateTarget: false,
        canSecureSurvival: false,
        canForceRelegation: false,
      }),
    ).toEqual([])

    // Offene Zielzone + Spieltag kann sichern → secure-from bleibt
    const border: HardRange = { teamId: 1, hardBest: 1, hardWorst: 10 }
    const kept = filterMatchdayTriggersBySeasonHard(lines, border, 'bl2', {
      canSecureTarget: true,
      canEliminateTarget: false,
      canSecureSurvival: false,
      canForceRelegation: false,
    })
    expect(kept.map((l) => l.key)).toEqual(['target-secure-from'])
  })

  it('deriveMatchdayPositionLines: Zonen inkl. schon belegter Plätze, keine Spanne', () => {
    const mid = deriveMatchdayPositionLines(
      [
        { points: 4, rank: 8 },
        { points: 3, rank: 10 },
        { points: 1, rank: 12 },
      ],
      9,
      'bl2',
    )
    expect(mid).toEqual([])

    const leader = deriveMatchdayPositionLines(
      [
        { points: 6, rank: 1 },
        { points: 4, rank: 5 },
        { points: 3, rank: 8 },
      ],
      4,
      'bl2',
    )
    const blob = leader.map((l) => `${l.label} ${l.primary}`).join(' ')
    expect(blob).toMatch(/kann Tabellenführer werden/)
    expect(blob).toMatch(/Aufstiegsplatz möglich/)
    expect(blob).not.toMatch(/kann auf Platz|Platz \d+–\d+|bleibt Platz \d/)

    const onCl = deriveMatchdayPositionLines(
      [
        { points: 50, rank: 3 },
        { points: 48, rank: 4 },
        { points: 47, rank: 5 },
      ],
      3,
      'bl1',
    )
    const clBlob = onCl.map((l) => l.primary).join(' ')
    expect(clBlob).toMatch(/CL-Platz/)
    expect(clBlob).toMatch(/bleibt CL-Platz möglich|CL-Platz möglich|CL-Platz sicher/)

    const bl1Zones = deriveMatchdayPositionLines(
      [
        { points: 40, rank: 5 },
        { points: 38, rank: 6 },
        { points: 36, rank: 8 },
      ],
      7,
      'bl1',
    )
    const zBlob = bl1Zones.map((l) => l.primary).join(' ')
    expect(zBlob).toMatch(/EL-Platz|ECL-Platz/)
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

describe('seasonFateStillOpen', () => {
  it('ist offen, wenn Saison-Spanne noch Ziel und Abstieg umfasst', () => {
    expect(
      seasonFateStillOpen({ teamId: 1, hardBest: 1, hardWorst: 18 }, 'bl2'),
    ).toBe(true)
    expect(
      seasonFateStillOpen({ teamId: 1, hardBest: 1, hardWorst: 10 }, 'bl2'),
    ).toBe(false)
    expect(
      seasonFateStillOpen({ teamId: 1, hardBest: 5, hardWorst: 18 }, 'bl2'),
    ).toBe(false)
  })
})
