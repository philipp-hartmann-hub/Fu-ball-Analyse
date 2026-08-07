import type { MatchPrediction } from '../lib/simulation'
import { NOT_ENOUGH_DATA_LABEL } from '../lib/reliability'
import type { ExplainTopic } from '../lib/modelExplanations'
import { ExplainLink } from './ExplainLink'

export type FocusPerspective = 'home' | 'away' | 'neutral'

function pct(p: number): number {
  return Math.round(p * 100)
}

function outcomeFromFocus(
  prediction: MatchPrediction,
  perspective: FocusPerspective,
): { win: number; draw: number; loss: number } {
  if (perspective === 'away') {
    return {
      win: prediction.pAway,
      draw: prediction.pDraw,
      loss: prediction.pHome,
    }
  }
  // Heim oder neutral: 1 / X / 2
  return {
    win: prediction.pHome,
    draw: prediction.pDraw,
    loss: prediction.pAway,
  }
}

function labelsFor(perspective: FocusPerspective): [string, string, string] {
  if (perspective === 'neutral') return ['Heimsieg', 'Remis', 'Auswärtssieg']
  return ['Sieg', 'Remis', 'Niederlage']
}

interface Props {
  prediction: MatchPrediction | null
  /** Aus Sicht des Fokusvereins; neutral = 1/X/2 */
  perspective?: FocusPerspective
  /** Kurzkontext, z. B. „Nächstes Spiel“ */
  title?: string
  homeName?: string
  awayName?: string
  onExplain?: (topic: ExplainTopic) => void
  compact?: boolean
}

export function MatchPredictionCard({
  prediction,
  perspective = 'neutral',
  title = 'Spielschätzung',
  homeName,
  awayName,
  onExplain,
  compact = false,
}: Props) {
  if (!prediction) return null

  const locked = prediction.lockedScenario
  const [winLabel, drawLabel, lossLabel] = labelsFor(perspective)
  const outcomes = outcomeFromFocus(prediction, perspective)
  const scoreFromFocus =
    perspective === 'away'
      ? {
          focus: prediction.likelyScore.away,
          opp: prediction.likelyScore.home,
        }
      : {
          focus: prediction.likelyScore.home,
          opp: prediction.likelyScore.away,
        }

  return (
    <div
      className={`match-prediction${compact ? ' is-compact' : ''}`}
      role="group"
      aria-label={title}
    >
      <div className="match-prediction-head">
        <span className="label">
          {title}
          {onExplain && (
            <>
              {' '}
              <ExplainLink
                topic="forecast"
                onExplain={onExplain}
                className="explain-inline"
              >
                Erklärung
              </ExplainLink>
            </>
          )}
        </span>
      </div>

      {locked ? (
        <p className="match-prediction-locked" role="status">
          von dir gesetzt:{' '}
          <strong>
            {locked.homeGoals}:{locked.awayGoals}
          </strong>
          {homeName && awayName
            ? ` (${homeName} – ${awayName})`
            : ''}
        </p>
      ) : !prediction.reliable ? (
        <p className="hint tight forecast-pending-note">{NOT_ENOUGH_DATA_LABEL}</p>
      ) : (
        <>
          <ul className="match-prediction-bars">
            {(
              [
                ['win', winLabel, outcomes.win],
                ['draw', drawLabel, outcomes.draw],
                ['loss', lossLabel, outcomes.loss],
              ] as const
            ).map(([key, label, p]) => {
              const value = pct(p)
              return (
                <li key={key} className={`match-prediction-row tone-${key}`}>
                  <span className="match-prediction-label">{label}</span>
                  <span className="match-prediction-pct">{value}%</span>
                  <div className="forecast-bar" aria-hidden>
                    <span
                      className={`forecast-fill match-fill-${key}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="match-prediction-score">
            Wahrscheinlichstes Ergebnis:{' '}
            <strong>
              {perspective === 'neutral'
                ? `${prediction.likelyScore.home}:${prediction.likelyScore.away}`
                : `${scoreFromFocus.focus}:${scoreFromFocus.opp}`}
            </strong>
            <span className="match-prediction-exp">
              {' '}
              · erwartet ~{prediction.expHome.toFixed(1)}:
              {prediction.expAway.toFixed(1)}
            </span>
          </p>
          <p className="hint tight match-prediction-disclaimer">
            Modellschätzung, keine Vorhersage · kein Tipp / keine Quote
          </p>
        </>
      )}
    </div>
  )
}
