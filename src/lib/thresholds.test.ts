import { describe, expect, it } from 'vitest'
import { deriveThresholdLines, type ThresholdLine } from './thresholds'

function pointValues(lines: ThresholdLine[]): number[] {
  return lines
    .map((l) => {
      const m = l.primary.match(/^(\d+)\s*Pkt/)
      return m ? Number(m[1]) : null
    })
    .filter((n): n is number => n != null)
}

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
      { exact: true, reachableMax: 43, horizon: 'matchday' },
    )
    expect(lines.some((l) => l.key === 'survive-safe')).toBe(true)
    expect(lines.some((l) => l.key === 'releg-certain')).toBe(false)
  })

  it('Sicherer Klassenerhalt ab max. Abstiegs-Punkten + 1 (innerhalb reachableMax)', () => {
    const lines = deriveThresholdLines(
      [
        { points: 38, rank: 16 },
        { points: 41, rank: 12 },
        { points: 39, rank: 17 },
      ],
      36,
      14,
      'bl1',
      { exact: true, reachableMax: 39, horizon: 'matchday' },
    )
    // safeFrom = 39+1 = 40 > reachableMax 39 → keine survive-from-Zeile
    expect(lines.find((l) => l.key === 'survive-from')).toBeUndefined()

    const ok = deriveThresholdLines(
      [
        { points: 38, rank: 16 },
        { points: 41, rank: 12 },
        { points: 39, rank: 17 },
      ],
      38,
      14,
      'bl1',
      { exact: true, reachableMax: 41, horizon: 'matchday' },
    )
    const row = ok.find((l) => l.key === 'survive-from')
    expect(row?.primary).toBe('40 Pkt.')
    expect(row?.secondary).toBe('noch 2 Pkt.')
    expect(row?.label).toContain('Abstiegsplatz')
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
      { exact: true, reachableMax: 33, horizon: 'matchday' },
    )
    expect(lines.find((l) => l.key === 'releg-certain')?.primary).toBe(
      'Abstiegsplatz',
    )
  })

  it('CL sicher ab / möglich ab nur innerhalb reachableMax', () => {
    const lines = deriveThresholdLines(
      [
        { points: 50, rank: 5 },
        { points: 55, rank: 3 },
        { points: 52, rank: 6 },
      ],
      50,
      5,
      'bl1',
      { exact: true, reachableMax: 53, horizon: 'matchday' },
    )
    // safeFrom = 52+1 = 53 ≤ 53 → ok; minPtsTarget 55 > 53 → weg
    expect(lines.find((l) => l.key === 'target-secure-from')?.primary).toBe(
      '53 Pkt.',
    )
    expect(lines.find((l) => l.key === 'target-possible-from')).toBeUndefined()
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
      { exact: true, reachableMax: 61, horizon: 'matchday' },
    )
    expect(lines.some((l) => l.key.startsWith('survive') || l.key.startsWith('releg'))).toBe(
      false,
    )
    expect(lines.some((l) => l.key === 'target-safe')).toBe(true)
  })

  it('Saison-Heuristik: keine Punkt-Zahlen, nur qualitative Extremfälle', () => {
    const open = deriveThresholdLines(
      [
        { points: 40, rank: 10 },
        { points: 30, rank: 16 },
      ],
      35,
      12,
      'bl1',
      { exact: false, horizon: 'season' },
    )
    // Ziel (Rang 10 ist kein CL) und Abstieg beide möglich? Rang 10 ist midfield,
    // canReachTarget=false, canRelegate=true → qualitative Abstieg/Target-gone möglich
    // Best 10: nicht CL; Worst 16: Abstieg → canReachTarget false, canRelegate true
    // → nicht (canReachTarget && canRelegate) → qualitative: target-gone + nicht survive-safe
    expect(pointValues(open)).toHaveLength(0)
    expect(open.find((l) => l.key === 'target-gone')?.primary).toContain(
      'nicht mehr erreichbar',
    )
    expect(open.find((l) => l.key === 'target-gone')?.primary).toContain('Schätzung')
  })

  it('BL2: Aufstieg statt CL', () => {
    const lines = deriveThresholdLines(
      [
        { points: 50, rank: 3 },
        { points: 55, rank: 2 },
      ],
      52,
      4,
      'bl2',
      { exact: true, reachableMax: 55, horizon: 'matchday' },
    )
    expect(lines.some((l) => l.label.includes('Aufstiegsplatz'))).toBe(true)
    expect(lines.some((l) => /\bCL\b/.test(l.label))).toBe(false)
  })

  describe('Saisonstart / offenes Regime', () => {
    const seasonStartOutcomes = [
      { points: 3, rank: 1 },
      { points: 1, rank: 9 },
      { points: 0, rank: 18 },
    ]

    it('Spieltag: keine Punkt-Schwellen wenn Ziel und Abstieg beide möglich', () => {
      const lines = deriveThresholdLines(
        seasonStartOutcomes,
        0,
        10,
        'bl1',
        { exact: true, reachableMax: 3, horizon: 'matchday' },
      )
      expect(lines).toEqual([])
      expect(pointValues(lines)).toHaveLength(0)
    })

    it('Saison (Zwei-Punkt-Heuristik): keine Punkt-Schwellenzeile', () => {
      const lines = deriveThresholdLines(
        [
          { points: 102, rank: 1 },
          { points: 0, rank: 18 },
        ],
        0,
        10,
        'bl1',
        { exact: false, horizon: 'season' },
      )
      expect(lines).toEqual([])
      expect(pointValues(lines)).toHaveLength(0)
    })
  })

  it('später Klassenerhalt fast durch: korrekte Schwelle ≤ reachableMax', () => {
    const lines = deriveThresholdLines(
      [
        { points: 36, rank: 16 },
        { points: 37, rank: 15 },
        { points: 39, rank: 12 },
      ],
      36,
      15,
      'bl1',
      { exact: true, reachableMax: 39, horizon: 'matchday' },
    )
    const row = lines.find((l) => l.key === 'survive-from')
    expect(row?.primary).toBe('37 Pkt.')
    expect(pointValues(lines).every((p) => p <= 39)).toBe(true)
  })

  it('CL rechnerisch weg: qualitative Zeile ohne Punkt-Zahl', () => {
    const lines = deriveThresholdLines(
      [
        { points: 40, rank: 8 },
        { points: 43, rank: 7 },
      ],
      40,
      9,
      'bl1',
      { exact: true, reachableMax: 43, horizon: 'matchday' },
    )
    const gone = lines.find((l) => l.key === 'target-gone')
    expect(gone?.primary).toBe('kein CL-Platz')
    expect(gone?.primary).not.toMatch(/\d+\s*Pkt/)
    expect(lines.some((l) => l.key.includes('from'))).toBe(false)
  })

  it('kein Schwellenwert darf reachableMax überschreiten', () => {
    const reachableMax = 42
    const lines = deriveThresholdLines(
      [
        { points: 38, rank: 16 },
        { points: 41, rank: 12 },
        { points: 45, rank: 3 },
        { points: 50, rank: 2 },
        { points: 39, rank: 17 },
      ],
      39,
      14,
      'bl1',
      { exact: true, reachableMax, horizon: 'matchday' },
    )
    // Offenes Regime: canReachTarget && canRelegate → []
    expect(lines).toEqual([])

    const onlySurvival = deriveThresholdLines(
      [
        { points: 38, rank: 16 },
        { points: 41, rank: 12 },
        { points: 44, rank: 10 },
        { points: 39, rank: 17 },
      ],
      39,
      14,
      'bl1',
      { exact: true, reachableMax, horizon: 'matchday' },
    )
    for (const p of pointValues(onlySurvival)) {
      expect(p).toBeLessThanOrEqual(reachableMax)
    }
  })

  it('Saison: Schlechtfall sicher → Klassenerhalt rechnerisch sicher (Schätzung)', () => {
    const lines = deriveThresholdLines(
      [
        { points: 55, rank: 6 },
        { points: 48, rank: 12 },
      ],
      45,
      10,
      'bl1',
      { exact: false, horizon: 'season' },
    )
    expect(lines.find((l) => l.key === 'survive-safe')?.primary).toContain(
      'rechnerisch sicher',
    )
    expect(lines.find((l) => l.key === 'survive-safe')?.primary).toContain('Schätzung')
    expect(pointValues(lines)).toHaveLength(0)
  })

  it('Saison: Schlechtfall schon CL → CL rechnerisch sicher (Schätzung)', () => {
    const lines = deriveThresholdLines(
      [
        { points: 70, rank: 1 },
        { points: 62, rank: 4 },
      ],
      60,
      3,
      'bl1',
      { exact: false, horizon: 'season' },
    )
    expect(lines.find((l) => l.key === 'target-safe')?.primary).toContain(
      'rechnerisch sicher',
    )
    expect(pointValues(lines)).toHaveLength(0)
  })

  it('Spieltag (Näherung): Platz-Formulierung, kein Saison-Urteil', () => {
    const lines = deriveThresholdLines(
      [
        { points: 6, rank: 8 },
        { points: 3, rank: 12 },
      ],
      3,
      10,
      'bl2',
      { exact: false, horizon: 'matchday' },
    )
    const gone = lines.find((l) => l.key === 'target-gone')
    expect(gone?.primary).toContain('kein Aufstiegsplatz')
    expect(gone?.primary).not.toMatch(/nicht mehr erreichbar/)
    expect(lines.some((l) => /Klassenerhalt|Aufstieg/.test(l.label))).toBe(
      false,
    )
  })
})
