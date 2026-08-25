import { describe, expect, it } from 'vitest'
import {
  midSeasonBl1Fixture,
  twoGamesBl1Fixture,
  weakVsStrongRestFixture,
  zeroGamesBl1Fixture,
} from './__fixtures__/consistencyFixtures'
import {
  buildDecisionRadar,
  TITLE_GONE_NEAR_PLACES,
  isTitleGoneRelevant,
  lastTopTargetRank,
  pruneSeasonTriggers,
} from './decisions'
import {
  hasEnoughData,
  NOT_ENOUGH_DATA_LABEL,
} from './reliability'
import {
  computeExactPositionRanges,
  computeHardRanges,
  computePositionRanges,
} from './scenarios'
import {
  computeScheduleHardness,
  type HardnessGrade,
} from './schedule'
import {
  deriveMatchLean,
  deriveTeamStrengths,
  predictFixture,
  predictMatch,
  runSeasonSimulation,
  type TeamStrength,
} from './simulation'
import { isRelegationRank, isTopTargetRank } from './thresholds'
import { rankStandings, zoneForRank } from './table'
import { computeTeamTrend } from './trend'
import type { Match, StandingRow } from '../types'

/** Unabhängiges 3^n-Orakel (wie in scenarios.test) — nicht die Produktionsfunktion. */
const GOAL_OUTCOMES: [number, number][] = [
  [1, 0],
  [0, 0],
  [0, 1],
]

function bruteForceTrueRanges(base: StandingRow[], remaining: Match[]) {
  const best = new Map<number, number>()
  const worst = new Map<number, number>()
  for (const row of base) {
    best.set(row.teamId, base.length)
    worst.set(row.teamId, 1)
  }
  const total = 3 ** remaining.length
  for (let mask = 0; mask < total; mask++) {
    const map = new Map(base.map((s) => [s.teamId, { ...s }]))
    const scores: Array<{
      matchId: number
      homeId: number
      awayId: number
      homeGoals: number
      awayGoals: number
    }> = []
    let x = mask
    for (const match of remaining) {
      const [hg, ag] = GOAL_OUTCOMES[x % 3]!
      x = Math.floor(x / 3)
      const home = map.get(match.team1.teamId)!
      const away = map.get(match.team2.teamId)!
      home.played += 1
      away.played += 1
      home.goalsFor += hg
      home.goalsAgainst += ag
      away.goalsFor += ag
      away.goalsAgainst += hg
      home.goalDiff = home.goalsFor - home.goalsAgainst
      away.goalDiff = away.goalsFor - away.goalsAgainst
      if (hg > ag) {
        home.won += 1
        home.points += 3
        away.lost += 1
      } else if (hg < ag) {
        away.won += 1
        away.points += 3
        home.lost += 1
      } else {
        home.draw += 1
        away.draw += 1
        home.points += 1
        away.points += 1
      }
      scores.push({
        matchId: match.matchID,
        homeId: match.team1.teamId,
        awayId: match.team2.teamId,
        homeGoals: hg,
        awayGoals: ag,
      })
    }
    const table = rankStandings(
      [...map.values()].map(({ rank: _r, ...rest }) => rest),
      { matchScores: scores },
    )
    for (const row of table) {
      if (row.rank < best.get(row.teamId)!) best.set(row.teamId, row.rank)
      if (row.rank > worst.get(row.teamId)!) worst.set(row.teamId, row.rank)
    }
  }
  return base.map((row) => ({
    teamId: row.teamId,
    bestRank: best.get(row.teamId)!,
    worstRank: worst.get(row.teamId)!,
  }))
}

/**
 * Modulübergreifende Konsistenz — fängt wiederholte Fehlerklassen ab.
 * Bei Rot: nicht den Test aufweichen, sondern den Widerspruch im Produktivcode fixen.
 */

describe('Konsistenz: Spanne (exact ⊆ hard, Soundness, Köln/Bremen)', () => {
  it('Spanne-Konsistenz: exact ⊆ hard für jedes Team (Mid-Season)', () => {
    const { standings, remaining } = midSeasonBl1Fixture()
    const hard = computeHardRanges(standings, remaining)
    const exact = computeExactPositionRanges(standings, remaining)
    expect(exact).not.toBeNull()
    for (const e of exact!) {
      const h = hard.find((x) => x.teamId === e.teamId)!
      expect(h.hardBest).toBeLessThanOrEqual(e.bestRank)
      expect(h.hardWorst).toBeGreaterThanOrEqual(e.worstRank)
    }
  })

  it('Spanne-Konsistenz: PositionRanges (UI) liegen innerhalb der harten Spanne', () => {
    const { standings, remaining } = midSeasonBl1Fixture()
    const hard = computeHardRanges(standings, remaining)
    const ranges = computePositionRanges(standings, remaining)
    for (const r of ranges) {
      const h = hard.find((x) => x.teamId === r.teamId)!
      expect(h.hardBest).toBeLessThanOrEqual(r.bestRank)
      expect(h.hardWorst).toBeGreaterThanOrEqual(r.worstRank)
    }
  })

  it('Spanne-Konsistenz: Köln/Bremen punktgleich — niemand fälschlich fix (14./15.)', () => {
    const { standings, remaining, koeId, breId } = midSeasonBl1Fixture()
    const hard = computeHardRanges(standings, remaining)
    const koe = hard.find((h) => h.teamId === koeId)!
    const bre = hard.find((h) => h.teamId === breId)!
    expect(koe.hardBest).toBe(14)
    expect(koe.hardWorst).toBe(15)
    expect(bre.hardBest).toBe(14)
    expect(bre.hardWorst).toBe(15)
    expect(koe.hardBest).not.toBe(koe.hardWorst)
    expect(bre.hardBest).not.toBe(bre.hardWorst)
  })

  it('Spanne-Konsistenz: harte Spanne enthält Brute-Force-wahre Spanne (Soundness)', () => {
    const { standings, remaining } = midSeasonBl1Fixture()
    expect(remaining.length).toBeLessThanOrEqual(8) // 3^n Orakel bleibt tragbar
    const hard = computeHardRanges(standings, remaining)
    const truth = bruteForceTrueRanges(standings, remaining)
    for (const t of truth) {
      const h = hard.find((x) => x.teamId === t.teamId)!
      expect(h.hardBest).toBeLessThanOrEqual(t.bestRank)
      expect(h.hardWorst).toBeGreaterThanOrEqual(t.worstRank)
    }
  })
})

describe('Konsistenz: Radar ⟷ Spanne (Status widerspricht nie hard)', () => {
  function assertStatusesMatchHard(
    statuses: { kind: string }[],
    hardBest: number,
    hardWorst: number,
    league: 'bl1' | 'bl2' | 'bl3',
  ) {
    const kinds = new Set(statuses.map((s) => s.kind))
    if (kinds.has('safe')) {
      expect(isRelegationRank(hardWorst, league)).toBe(false)
    }
    if (kinds.has('relegated')) {
      expect(isRelegationRank(hardBest, league)).toBe(true)
    }
    if (kinds.has('champion')) {
      expect(hardWorst).toBe(1)
    }
    if (kinds.has('title_secure')) {
      expect(isTopTargetRank(hardWorst, league)).toBe(true)
    }
    if (kinds.has('title_gone')) {
      expect(isTopTargetRank(hardBest, league)).toBe(false)
    }
  }

  it('Radar⟷Spanne: jeder Saison-Status ist mit hardBest/hardWorst vereinbar', () => {
    const { standings, remaining } = midSeasonBl1Fixture()
    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: true,
    })
    for (const row of radar.all) {
      assertStatusesMatchHard(
        row.confirmedStatuses,
        row.confirmedHard.hardBest,
        row.confirmedHard.hardWorst,
        'bl1',
      )
    }
  })

  it('Radar⟷Spanne: Gegentest — Spanne über Zonengrenze ⇒ kein feststehender Zonen-Status', () => {
    const { standings, remaining } = midSeasonBl1Fixture()
    const hard = computeHardRanges(standings, remaining)
    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: false,
    })

    for (const h of hard) {
      const row = radar.all.find((r) => r.teamId === h.teamId)!
      const kinds = new Set(row.confirmedStatuses.map((s) => s.kind))

      // Spanne berührt noch Abstieg → kein „Gerettet“
      if (isRelegationRank(h.hardWorst, 'bl1')) {
        expect(kinds.has('safe')).toBe(false)
      }
      // Spanne erreicht noch Nicht-Abstieg → kein „Abgestiegen“
      if (!isRelegationRank(h.hardBest, 'bl1')) {
        expect(kinds.has('relegated')).toBe(false)
      }
      // Spanne nicht auf Platz 1 begrenzt → kein Meister
      if (h.hardWorst !== 1) {
        expect(kinds.has('champion')).toBe(false)
      }
      // Spanne nicht ganz in Top-Ziel → kein title_secure
      if (!isTopTargetRank(h.hardWorst, 'bl1')) {
        expect(kinds.has('title_secure')).toBe(false)
      }
      // Spanne noch im Top-Ziel möglich → kein title_gone
      if (isTopTargetRank(h.hardBest, 'bl1')) {
        expect(kinds.has('title_gone')).toBe(false)
      }

      // Zone-Grenzen: wenn Spanne mehrere Zonen kreuzt, kein „sicher“-Status der Randzone
      const zones = new Set<string>()
      for (let r = h.hardBest; r <= h.hardWorst; r++) {
        zones.add(zoneForRank(r, 'bl1'))
      }
      if (zones.size > 1) {
        expect(kinds.has('champion')).toBe(false)
        expect(kinds.has('safe') && isRelegationRank(h.hardWorst, 'bl1')).toBe(
          false,
        )
      }
    }
  })
})

describe('Konsistenz: Restprogramm ⟷ Spielschätzung (gleiches Modell)', () => {
  it('Restprogramm⟷Spielschätzung: Loss-Mehrheit ⇒ Stufe nicht leicht/sehr leicht (Köln-Fall)', () => {
    const { standings, remaining, focusId } = weakVsStrongRestFixture()
    const hardness = computeScheduleHardness(remaining, standings).find(
      (h) => h.teamId === focusId,
    )!
    expect(hardness.reliable).toBe(true)

    let lossLikely = 0
    let winLikely = 0
    for (const m of remaining) {
      const pred = predictFixture(standings, m)!
      const home = m.team1.teamId === focusId
      const lean = deriveMatchLean(pred, home ? 'home' : 'away')
      if (lean.outcome === 'loss' && lean.confidence === 'likely') lossLikely += 1
      if (lean.outcome === 'win' && lean.confidence === 'likely') winLikely += 1
    }
    const n = remaining.filter(
      (m) =>
        m.team1.teamId === focusId || m.team2.teamId === focusId,
    ).length
    expect(lossLikely).toBeGreaterThan(n / 2)

    const light: HardnessGrade[] = ['very-easy', 'easy']
    expect(light.includes(hardness.grade!)).toBe(false)
    expect(hardness.grade === 'hard' || hardness.grade === 'very-hard').toBe(
      true,
    )
    void winLikely
  })

  it('Restprogramm⟷Spielschätzung: Win-Mehrheit ⇒ Stufe nicht schwer/sehr schwer', () => {
    const played = 20
    const strong = {
      teamId: 1,
      teamName: 'Bayern',
      shortName: 'FCB',
      teamIconUrl: '',
    }
    const weakA = {
      teamId: 16,
      teamName: 'SchwachA',
      shortName: 'SA',
      teamIconUrl: '',
    }
    const weakB = {
      teamId: 17,
      teamName: 'SchwachB',
      shortName: 'SB',
      teamIconUrl: '',
    }
    const weakC = {
      teamId: 18,
      teamName: 'SchwachC',
      shortName: 'SC',
      teamIconUrl: '',
    }
    const standings: StandingRow[] = [
      {
        teamId: 1,
        teamName: 'Bayern',
        shortName: 'FCB',
        teamIconUrl: '',
        played,
        won: 16,
        draw: 2,
        lost: 2,
        goalsFor: 55,
        goalsAgainst: 12,
        goalDiff: 43,
        points: 50,
        rank: 1,
      },
      {
        teamId: 16,
        teamName: 'SchwachA',
        shortName: 'SA',
        teamIconUrl: '',
        played,
        won: 2,
        draw: 4,
        lost: 14,
        goalsFor: 14,
        goalsAgainst: 42,
        goalDiff: -28,
        points: 10,
        rank: 16,
      },
      {
        teamId: 17,
        teamName: 'SchwachB',
        shortName: 'SB',
        teamIconUrl: '',
        played,
        won: 2,
        draw: 3,
        lost: 15,
        goalsFor: 12,
        goalsAgainst: 45,
        goalDiff: -33,
        points: 9,
        rank: 17,
      },
      {
        teamId: 18,
        teamName: 'SchwachC',
        shortName: 'SC',
        teamIconUrl: '',
        played,
        won: 1,
        draw: 3,
        lost: 16,
        goalsFor: 10,
        goalsAgainst: 48,
        goalDiff: -38,
        points: 6,
        rank: 18,
      },
    ]
    const remaining = [
      {
        matchID: 1,
        matchDateTime: '2025-04-01T15:30:00',
        matchDateTimeUTC: '2025-04-01T13:30:00Z',
        leagueName: 'BL',
        leagueSeason: 2025,
        leagueShortcut: 'bl1',
        lastUpdateDateTime: '2025-04-01T17:00:00',
        group: { groupName: '30.', groupOrderID: 30, groupID: 30 },
        team1: strong,
        team2: weakA,
        matchIsFinished: false,
        matchResults: [],
        goals: [],
      },
      {
        matchID: 2,
        matchDateTime: '2025-04-01T15:30:00',
        matchDateTimeUTC: '2025-04-01T13:30:00Z',
        leagueName: 'BL',
        leagueSeason: 2025,
        leagueShortcut: 'bl1',
        lastUpdateDateTime: '2025-04-01T17:00:00',
        group: { groupName: '31.', groupOrderID: 31, groupID: 31 },
        team1: weakB,
        team2: strong,
        matchIsFinished: false,
        matchResults: [],
        goals: [],
      },
      {
        matchID: 3,
        matchDateTime: '2025-04-01T15:30:00',
        matchDateTimeUTC: '2025-04-01T13:30:00Z',
        leagueName: 'BL',
        leagueSeason: 2025,
        leagueShortcut: 'bl1',
        lastUpdateDateTime: '2025-04-01T17:00:00',
        group: { groupName: '32.', groupOrderID: 32, groupID: 32 },
        team1: strong,
        team2: weakC,
        matchIsFinished: false,
        matchResults: [],
        goals: [],
      },
    ]

    const hardness = computeScheduleHardness(remaining, standings).find(
      (h) => h.teamId === 1,
    )!
    let winLikely = 0
    for (const m of remaining) {
      const pred = predictFixture(standings, m)!
      const home = m.team1.teamId === 1
      const lean = deriveMatchLean(pred, home ? 'home' : 'away')
      if (lean.outcome === 'win' && lean.confidence === 'likely') winLikely += 1
    }
    expect(winLikely).toBeGreaterThan(remaining.length / 2)
    expect(hardness.grade === 'hard' || hardness.grade === 'very-hard').toBe(
      false,
    )
  })
})

describe('Konsistenz: Reliabilität am Saisonstart (0-Spiele)', () => {
  it('Saisonstart: alle modellbasierten Features ohne Aussage (Härte, Trend, Spielschätzung, Prognose)', () => {
    const { standings, remaining, played } = zeroGamesBl1Fixture()
    expect(hasEnoughData(standings)).toBe(false)

    type FeatureCheck = { name: string; assertNoStatement: () => void }
    const features: FeatureCheck[] = [
      {
        name: 'Restprogramm-Härte',
        assertNoStatement: () => {
          const hardness = computeScheduleHardness(remaining, standings)
          expect(hardness.every((h) => h.reliable === false)).toBe(true)
          expect(hardness.every((h) => h.grade === null)).toBe(true)
        },
      },
      {
        name: 'Trend',
        assertNoStatement: () => {
          for (const row of standings) {
            const trend = computeTeamTrend(row.teamId, played, standings)
            expect(trend.reliable).toBe(false)
            expect(trend.grade).toBeNull()
          }
        },
      },
      {
        name: 'Spielschätzung',
        assertNoStatement: () => {
          for (const m of remaining.slice(0, 9)) {
            const pred = predictFixture(standings, m, {
              playedMatches: played,
            })!
            expect(pred.reliable).toBe(false)
            const lean = deriveMatchLean(pred, 'home')
            expect(lean.reliable).toBe(false)
            expect(lean.label).toBe('noch keine Aussage')
            expect(lean.probability).toBe(0)
          }
        },
      },
      {
        name: 'Prognose',
        assertNoStatement: () => {
          expect(hasEnoughData(standings)).toBe(false)
          const cellLabel = hasEnoughData(standings)
            ? 'Meister 42%'
            : NOT_ENOUGH_DATA_LABEL
          expect(cellLabel).toBe(NOT_ENOUGH_DATA_LABEL)
          expect(cellLabel).not.toMatch(/%/)
          const sim = runSeasonSimulation({
            baseStandings: standings,
            remaining: remaining.slice(0, 2),
            league: 'bl1',
            runs: 40,
            seed: 1,
            playedScores: [],
          })
          expect(sim.teams.length).toBe(standings.length)
        },
      },
    ]

    for (const f of features) {
      f.assertNoStatement()
    }
    expect(features.map((f) => f.name)).toEqual([
      'Restprogramm-Härte',
      'Trend',
      'Spielschätzung',
      'Prognose',
    ])
  })
})

describe('Konsistenz: Radar bereinigt (Hart > Näherung, kein triviales title_gone)', () => {
  it('Radar-Bereinigung: harter Status ⇒ keine Näherung zur selben Zone', () => {
    const { standings, remaining } = midSeasonBl1Fixture()
    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: true,
    })

    for (const row of radar.all) {
      const kinds = new Set(row.confirmedStatuses.map((s) => s.kind))
      const keys = row.seasonTriggers.map((t) => t.key)

      if (kinds.has('relegated')) {
        expect(keys).not.toContain('releg-certain')
        expect(
          keys.some(
            (k) =>
              k === 'season-direct-relegation-safe' ||
              k === 'season-relegation-safe',
          ),
        ).toBe(false)
        expect(keys).not.toContain('target-gone')
      }
      if (kinds.has('safe')) {
        expect(keys).not.toContain('survive-safe')
        expect(keys).not.toContain('target-gone')
      }
      if (kinds.has('title_secure') || kinds.has('champion')) {
        expect(keys).not.toContain('target-safe')
        expect(keys).not.toContain('season-cl-safe')
      }
      if (kinds.has('title_gone')) {
        expect(keys).not.toContain('target-gone')
      }
    }
  })

  it('Radar-Bereinigung: kein title_gone weit von der Zielzone (Schwelle TITLE_GONE_NEAR_PLACES)', () => {
    const { standings, remaining } = midSeasonBl1Fixture()
    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: true,
    })
    const cutoff = lastTopTargetRank('bl1') + TITLE_GONE_NEAR_PLACES

    for (const row of radar.all) {
      const hard = row.confirmedHard
      const hasGone = row.confirmedStatuses.some((s) => s.kind === 'title_gone')
      if (hard.hardBest > cutoff) {
        expect(hasGone).toBe(false)
      }
      expect(hasGone).toBe(
        isTitleGoneRelevant(hard, 'bl1', row.rank) &&
          !isTopTargetRank(hard.hardBest, 'bl1') &&
          hard.hardWorst !== 1,
      )

      if (row.confirmedStatuses.some((s) => s.kind === 'relegated')) {
        expect(hasGone).toBe(false)
        const blob = row.seasonTriggers.map((t) => t.primary).join(' ')
        expect(blob).not.toMatch(/CL|nicht mehr möglich/i)
      }
    }
  })

  it('Radar-Bereinigung: pruneSeasonTriggers entfernt Abstiegs-Näherung bei hart abgestiegen', () => {
    const hard = { teamId: 18, hardBest: 17, hardWorst: 18 }
    const statuses = [
      {
        kind: 'relegated' as const,
        shortLabel: 'Abgestiegen',
        label: 'Abgestiegen (Saison steht fest)',
        tone: 'bad' as const,
      },
    ]
    const pruned = pruneSeasonTriggers(
      statuses,
      [
        {
          key: 'season-direct-relegation-safe',
          label: 'Saison',
          primary: 'Abstiegsplatz sicher',
          tone: 'bad',
        },
        {
          key: 'target-gone',
          label: 'CL',
          primary: 'nicht mehr erreichbar (Schätzung)',
          tone: 'bad',
        },
      ],
      hard,
      'bl1',
      18,
    )
    expect(pruned).toEqual([])
  })
})

describe('Konsistenz: keine Saison-Clinch-Sprache früh', () => {
  function assertNoEarlyClinch(
    standings: StandingRow[],
    remaining: Match[],
    nowMs: number,
  ) {
    const hard = computeHardRanges(standings, remaining)
    expect(hard.every((h) => h.hardBest === 1 && h.hardWorst === 18)).toBe(true)

    const radar = buildDecisionRadar({
      league: 'bl1',
      confirmedStandings: standings,
      liveStandings: standings,
      remainingConfirmed: remaining,
      remainingLive: remaining,
      hasLive: false,
      includeTriggers: true,
      nowMs,
    })

    expect(radar.decided).toEqual([])
    for (const row of radar.all) {
      expect(row.confirmedStatuses).toEqual([])
      const seasonBlob = row.seasonTriggers
        .map((t) => `${t.label} ${t.primary} ${t.secondary ?? ''}`)
        .join(' ')
      expect(seasonBlob).not.toMatch(/sicher/i)
      expect(seasonBlob).not.toMatch(/nicht mehr erreichbar/i)
      expect(seasonBlob).not.toMatch(/nicht mehr möglich/i)
    }
  }

  it('Frühphase 0 Spiele: Radar ohne Saison-„sicher“/„nicht mehr erreichbar“ bei Spanne 1.–18.', () => {
    const { standings, remaining } = zeroGamesBl1Fixture()
    assertNoEarlyClinch(
      standings,
      remaining,
      Date.parse('2025-08-20T12:00:00Z'),
    )
  })

  it('Frühphase 2 Spiele: Radar ohne Saison-Clinch-Sprache bei Spanne 1.–18.', () => {
    const { standings, remaining } = twoGamesBl1Fixture()
    assertNoEarlyClinch(
      standings,
      remaining,
      Date.parse('2025-08-30T12:00:00Z'),
    )
  })
})

describe('Konsistenz: Stärke-Quelle einheitlich (deriveTeamStrengths)', () => {
  it('Stärke-Quelle: dieselbe deriveTeamStrengths-Ausgabe steuert Härte und Spielschätzung in dieselbe Richtung', () => {
    const { standings, remaining, weakId } = midSeasonBl1Fixture()
    const played = midSeasonBl1Fixture().played
    const base = deriveTeamStrengths(standings, played)

    const boosted = new Map(base.strengths)
    const focus = boosted.get(weakId)!
    boosted.set(weakId, {
      ...focus,
      attack: focus.attack + 1.5,
      defense: Math.max(0.3, focus.defense - 0.8),
    })
    const boostedBundle = {
      strengths: boosted,
      avgDefense: base.avgDefense,
    }

    const hardBase = computeScheduleHardness(remaining, standings, {
      precomputedStrengths: base,
      onlyTeamIds: [weakId],
    })[0]!
    const hardBoost = computeScheduleHardness(remaining, standings, {
      precomputedStrengths: boostedBundle,
      onlyTeamIds: [weakId],
    })[0]!
    expect(hardBoost.expectedPerGame).toBeGreaterThan(hardBase.expectedPerGame)

    const focusMatch = remaining.find(
      (m) => m.team1.teamId === weakId || m.team2.teamId === weakId,
    )!
    const predBase = predictFixture(standings, focusMatch, {
      precomputedStrengths: base,
    })!
    const predBoost = predictFixture(standings, focusMatch, {
      precomputedStrengths: boostedBundle,
    })!
    const home = focusMatch.team1.teamId === weakId
    const pWinBase = home ? predBase.pHome : predBase.pAway
    const pWinBoost = home ? predBoost.pHome : predBoost.pAway
    expect(pWinBoost).toBeGreaterThan(pWinBase)

    // Ohne Override: Härte und Fixture nutzen denselben deriveTeamStrengths-Lauf
    const auto = deriveTeamStrengths(standings, played)
    const hardAuto = computeScheduleHardness(remaining, standings, {
      playedMatches: played,
    }).find((h) => h.teamId === weakId)!
    const hardFromSame = computeScheduleHardness(remaining, standings, {
      precomputedStrengths: auto,
    }).find((h) => h.teamId === weakId)!
    expect(hardAuto.expectedPerGame).toBeCloseTo(hardFromSame.expectedPerGame, 10)

    const predAuto = predictFixture(standings, focusMatch, {
      playedMatches: played,
    })!
    const predFromSame = predictFixture(standings, focusMatch, {
      precomputedStrengths: auto,
    })!
    expect(predAuto.pHome).toBeCloseTo(predFromSame.pHome, 10)
  })

  it('Stärke-Quelle: Prognose reagiert in dieselbe Richtung wie Härte/Spielschätzung auf stärkere Tabellenwerte', () => {
    const { standings, remaining, weakId } = midSeasonBl1Fixture()
    const weakRemaining = remaining.filter(
      (m) => m.team1.teamId === weakId || m.team2.teamId === weakId,
    )

    const weakRow = standings.find((s) => s.teamId === weakId)!
    const strongerStandings = standings.map((s) =>
      s.teamId === weakId
        ? {
            ...s,
            goalsFor: weakRow.goalsFor + 40,
            goalsAgainst: Math.max(5, weakRow.goalsAgainst - 25),
            goalDiff: weakRow.goalDiff + 65,
          }
        : s,
    )

    const hardWeak = computeScheduleHardness(weakRemaining, standings).find(
      (h) => h.teamId === weakId,
    )!
    const hardStrong = computeScheduleHardness(
      weakRemaining,
      strongerStandings,
    ).find((h) => h.teamId === weakId)!
    expect(hardStrong.expectedPerGame).toBeGreaterThan(hardWeak.expectedPerGame)

    const m = weakRemaining[0]!
    const predWeak = predictFixture(standings, m)!
    const predStrong = predictFixture(strongerStandings, m)!
    const home = m.team1.teamId === weakId
    expect(home ? predStrong.pHome : predStrong.pAway).toBeGreaterThan(
      home ? predWeak.pHome : predWeak.pAway,
    )

    const simWeak = runSeasonSimulation({
      baseStandings: standings,
      remaining: weakRemaining,
      league: 'bl1',
      runs: 200,
      seed: 42,
    })
    const simStrong = runSeasonSimulation({
      baseStandings: strongerStandings,
      remaining: weakRemaining,
      league: 'bl1',
      runs: 200,
      seed: 42,
    })
    const expWeak = simWeak.teams.find((t) => t.teamId === weakId)!.expectedPoints
    const expStrong = simStrong.teams.find((t) => t.teamId === weakId)!
      .expectedPoints
    expect(expStrong).toBeGreaterThan(expWeak)
  })
})

describe('Konsistenz: predictMatch nutzt TeamStrength (kein Ad-hoc)', () => {
  it('Spielschätzung: predictMatch mit Strengths aus deriveTeamStrengths ist deterministisch und summiert zu 1', () => {
    const { standings, remaining, played } = midSeasonBl1Fixture()
    const { strengths, avgDefense } = deriveTeamStrengths(standings, played)
    const m = remaining[0]!
    const home = strengths.get(m.team1.teamId)!
    const away = strengths.get(m.team2.teamId)!
    const a = predictMatch(home, away, avgDefense)
    const b = predictMatch(home, away, avgDefense)
    expect(a).toEqual(b)
    expect(a.pHome + a.pDraw + a.pAway).toBeCloseTo(1, 10)
    // Typ-Guard: Strength-Shape unverändert
    const sample: TeamStrength = home
    expect(sample.attack).toBeGreaterThan(0)
    expect(sample.defense).toBeGreaterThan(0)
  })
})
