import type { MatchLean, MatchLeanOutcome } from '../lib/simulation'

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
   * `full` = „Sieg wahrscheinlich“ / „Niederlage möglich“
   * `letter` = nur S / U / N (Vergleich-Restprogramm)
   */
  variant?: 'full' | 'letter'
}

/** Favoriten-Ausgang: Label oder nur S/U/N — ohne Prozentzahl. */
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

  if (variant === 'letter') {
    return (
      <span
        className={`match-lean is-letter tone-${tone}${compact ? ' is-compact' : ''}`}
        title={lean.label}
      >
        {letterFor(lean.outcome)}
      </span>
    )
  }

  return (
    <span
      className={`match-lean tone-${tone}${compact ? ' is-compact' : ''}`}
      title={lean.label}
    >
      <span className="match-lean-label">{lean.label}</span>
    </span>
  )
}
