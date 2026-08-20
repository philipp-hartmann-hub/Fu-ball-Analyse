import type { MatchLean } from '../lib/simulation'

function pct(p: number): number {
  return Math.round(p * 100)
}

interface Props {
  lean: MatchLean | null
  /** Kurz für enge Listen */
  compact?: boolean
}

/** Eine Zeile: wahrscheinlichster Ausgang + Prozent (oder gesetzt / keine Aussage). */
export function MatchLeanChip({ lean, compact = false }: Props) {
  if (!lean) return null

  if (!lean.reliable) {
    return (
      <span
        className={`match-lean tone-pending${compact ? ' is-compact' : ''}`}
        title="Zu wenige Spiele für eine stabile Schätzung"
      >
        –
      </span>
    )
  }

  const tone =
    lean.outcome === 'win' ? 'win' : lean.outcome === 'loss' ? 'loss' : 'draw'
  const pctLabel = lean.locked ? null : `${pct(lean.probability)}%`

  return (
    <span
      className={`match-lean tone-${tone}${compact ? ' is-compact' : ''}`}
      title={
        lean.locked
          ? lean.label
          : `${lean.label} (${pctLabel}) · Modellschätzung`
      }
    >
      <span className="match-lean-label">{lean.label}</span>
      {pctLabel != null && (
        <span className="match-lean-pct">{pctLabel}</span>
      )}
    </span>
  )
}
