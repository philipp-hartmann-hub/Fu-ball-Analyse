import { describe, expect, it } from 'vitest'
import { deriveThresholdLines } from './thresholds'

describe('deriveThresholdLines', () => {
  it('Klassenerhalt sicher, wenn nie Abstieg', () => {
    const lines = deriveThresholdLines(
      [
        { points: 40, rank: 10 },
        { points: 42, rank: 8 },
      ],
      40,
      10,
      'bl1',
      { exact: true },
    )
    expect(lines.some((l) => l.key === 'survive-safe')).toBe(true)
    expect(lines.some((l) => l.key === 'releg-certain')).toBe(false)
  })

  it('Sicherer Klassenerhalt ab max. Abstiegs-Punkten + 1', () => {
    const lines = deriveThresholdLines(
      [
        { points: 38, rank: 16 },
        { points: 41, rank: 12 },
        { points: 39, rank: 17 },
      ],
      36,
      14,
      'bl1',
      { exact: true },
    )
    const row = lines.find((l) => l.key === 'survive-from')
    expect(row?.primary).toBe('40 Pkt.')
    expect(row?.secondary).toBe('noch 4 Pkt.')
  })

  it('Abstieg nicht mehr abwendbar', () => {
    const lines = deriveThresholdLines(
      [
        { points: 30, rank: 16 },
        { points: 33, rank: 17 },
      ],
      30,
      16,
      'bl1',
      { exact: true },
    )
    expect(lines.find((l) => l.key === 'releg-certain')?.primary).toBe(
      'nicht mehr abwendbar',
    )
  })

  it('CL sicher ab / nur möglich ab', () => {
    const lines = deriveThresholdLines(
      [
        { points: 50, rank: 5 },
        { points: 55, rank: 3 },
        { points: 52, rank: 6 },
      ],
      48,
      5,
      'bl1',
      { exact: true },
    )
    expect(lines.find((l) => l.key === 'target-secure-from')?.primary).toBe(
      '53 Pkt.',
    )
    expect(lines.find((l) => l.key === 'target-possible-from')?.primary).toBe(
      '55 Pkt.',
    )
  })

  it('kein Abstieg-Hinweis für Tabellenführer ohne Abstiegsrisiko', () => {
    const lines = deriveThresholdLines(
      [
        { points: 60, rank: 1 },
        { points: 58, rank: 1 },
      ],
      58,
      1,
      'bl1',
      { exact: true },
    )
    expect(lines.some((l) => l.key.startsWith('survive') || l.key.startsWith('releg'))).toBe(
      false,
    )
    expect(lines.some((l) => l.key === 'target-safe')).toBe(true)
  })

  it('kennzeichnet Saison-Näherung', () => {
    const lines = deriveThresholdLines(
      [
        { points: 40, rank: 10 },
        { points: 30, rank: 16 },
      ],
      35,
      12,
      'bl1',
      { exact: false },
    )
    expect(lines.find((l) => l.key === 'survive-from')?.primary).toContain(
      'Schätzung',
    )
  })

  it('BL2: Aufstieg statt CL', () => {
    const lines = deriveThresholdLines(
      [
        { points: 50, rank: 3 },
        { points: 55, rank: 2 },
      ],
      48,
      4,
      'bl2',
      { exact: true },
    )
    expect(lines.some((l) => l.label.includes('Aufstieg'))).toBe(true)
    expect(lines.some((l) => l.label === 'CL' || l.label.startsWith('CL '))).toBe(
      false,
    )
  })
})
