import {
  TREND_WINDOW,
  trendGradeArrow,
  trendGradeLabel,
  type TeamTrend,
} from '../lib/trend'

interface Props {
  trend: TeamTrend | null | undefined
  /** Kurzform ohne Meta-Hinweis (Vergleich) */
  compact?: boolean
  className?: string
}

export function TrendBadge({
  trend,
  compact = false,
  className = '',
}: Props) {
  if (!trend) {
    return (
      <span className={`trend-badge muted ${className}`.trim()}>–</span>
    )
  }

  if (!trend.reliable || !trend.grade) {
    return (
      <span
        className={`trend-badge tone-pending ${className}`.trim()}
        title="Zu wenige Spiele für eine Trendaussage"
      >
        noch kein Trend
        {!compact && (
          <span className="trend-meta"> (zu wenige Spiele)</span>
        )}
      </span>
    )
  }

  const label = trendGradeLabel(trend.grade)
  const arrow = trendGradeArrow(trend.grade)

  return (
    <span className={`trend-block ${className}`.trim()}>
      <span
        className={`trend-badge tone-${trend.grade}`}
        title={`Form der letzten ${TREND_WINDOW} Spiele relativ zur Erwartung`}
      >
        <span className="trend-arrow" aria-hidden>
          {arrow}
        </span>{' '}
        {label}
      </span>
      {!compact && (
        <span className="trend-meta">
          Form der letzten {TREND_WINDOW} Spiele, gewichtet nach Gegnerstärke
          (Modellschätzung)
        </span>
      )}
    </span>
  )
}
