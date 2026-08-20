import type { MatchLean, MatchLeanOutcome } from '../lib/simulation'

function pct(p: number): number {
  return Math.round(p * 100)
}

function letterFor(outcome: MatchLeanOutcome): string {
  if (outcome === 'win') return 'S'
  if (outcome === 'draw') return 'U'
  return 'N'
}

interface Props {
  lean: MatchLean | null
  /** Kurz für enge Listen */
  compact?: boolean
  /**
   * `full` = „Sieg wahrscheinlich · 62%“
   * `letter` = nur S / U / N (Vergleich-Restprogramm)
   */
  variant?: 'full' | 'letter'
}

/** Favoriten-Ausgang: ausführlich oder nur S/U/N. */
export function MatchLeanChip({
  lean,
  compact = false,
  variant = 'full',
}: Props) {
  if (!lean) return null

  if (!lean.reliable) {
    return (
      <span
        className={`match-lean tone-pending${compact ? ' is-compact' : ''}${
          variant === 'letter' ? ' is-letter' : ''
        }`}
        title="Zu wenige Spiele für eine stabile Schätzung"
      >
        –
      </span>
    )
  }

  const tone =
    lean.outcome === 'win' ? 'win' : lean.outcome === 'loss' ? 'loss' : 'draw'
  const pctLabel = lean.locked ? null : `${pct(lean.probability)}%`
  const title = lean.locked
    ? lean.label
    : `${lean.label}${pctLabel ? ` (${pctLabel})` : ''} · Modellschätzung`

  if (variant === 'letter') {
    return (
      <span
        className={`match-lean is-letter tone-${tone}${compact ? ' is-compact' : ''}`}
        title={title}
      >
        {letterFor(lean.outcome)}
      </span>
    )
  }

  return (
    <span
      className={`match-lean tone-${tone}${compact ? ' is-compact' : ''}`}
      title={title}
    >
      <span className="match-lean-label">{lean.label}</span>
      {pctLabel != null && (
        <span className="match-lean-pct">{pctLabel}</span>
      )}
    </span>
  )
}
