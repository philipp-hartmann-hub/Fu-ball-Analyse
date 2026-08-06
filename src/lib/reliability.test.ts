import { describe, expect, it } from 'vitest'
import {
  MIN_GAMES,
  NOT_ENOUGH_DATA_LABEL,
  hasEnoughData,
  medianGamesPlayed,
} from './reliability'

describe('reliability', () => {
  it('Median bei 0 Spielen ist 0', () => {
    expect(medianGamesPlayed([{ played: 0 }, { played: 0 }, { played: 0 }])).toBe(
      0,
    )
  })

  it('0 Spiele: hasEnoughData false → keine Prozentanzeige', () => {
    const standings = Array.from({ length: 18 }, () => ({ played: 0 }))
    expect(hasEnoughData(standings)).toBe(false)

    // UI-Gate (wie StandingsTable ForecastCell): pending statt „42%“
    const cellLabel = hasEnoughData(standings)
      ? 'Meister 42%'
      : NOT_ENOUGH_DATA_LABEL
    expect(cellLabel).toBe(NOT_ENOUGH_DATA_LABEL)
    expect(cellLabel).not.toMatch(/%/)
  })

  it(`Median ≥ ${MIN_GAMES}: hasEnoughData true`, () => {
    const standings = Array.from({ length: 18 }, () => ({ played: MIN_GAMES }))
    expect(hasEnoughData(standings)).toBe(true)
  })

  it(`Median knapp unter ${MIN_GAMES}: noch unverlässlich`, () => {
    const standings = Array.from({ length: 18 }, () => ({
      played: MIN_GAMES - 1,
    }))
    expect(hasEnoughData(standings)).toBe(false)
  })

  it('Härte und Prognose nutzen denselben Schwellwert', async () => {
    const { computeScheduleHardness } = await import('./schedule')
    const low = Array.from({ length: 4 }, (_, i) => ({
      teamId: i + 1,
      teamName: `T${i}`,
      shortName: `T${i}`,
      teamIconUrl: '',
      played: MIN_GAMES - 1,
      won: 0,
      draw: 0,
      lost: MIN_GAMES - 1,
      goalsFor: 0,
      goalsAgainst: MIN_GAMES - 1,
      goalDiff: -(MIN_GAMES - 1),
      points: 0,
      rank: i + 1,
    }))
    const high = low.map((s) => ({ ...s, played: MIN_GAMES }))
    expect(hasEnoughData(low)).toBe(false)
    expect(hasEnoughData(high)).toBe(true)
    const hardLow = computeScheduleHardness([], low)
    const hardHigh = computeScheduleHardness([], high)
    expect(hardLow.every((h) => !h.reliable)).toBe(true)
    expect(hardHigh.every((h) => h.reliable)).toBe(true)
  })
})
