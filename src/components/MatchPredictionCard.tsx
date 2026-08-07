import type { MatchPrediction } from '../lib/simulation'
import { NOT_ENOUGH_DATA_LABEL } from '../lib/reliability'
import type { ExplainTopic } from '../lib/modelExplanations'
import { ExplainLink } from './ExplainLink'

export type FocusPerspective = 'home' | 'away' | 'neutral'

function pct(p: number): number {
  return Math.round(p * 100)
}

/** Balken immer in Spielordnung 1 / X / 2 (Heim / Remis / Auswärts). */
function outcome1x2(prediction: MatchPrediction): {
  home: number
  draw: number
  away: number
} {
  return {
    home: prediction.pHome,
    draw: prediction.pDraw,
    away: prediction.pAway,
  }
}

/**
 * Aus Vereinssicht: Sieg / Unentschieden / Niederlage — nur für Balken-Labels.
 */
function outcomeFromFocus(
  prediction: MatchPrediction,
  perspective: 'home' | 'away',
): { win: number; draw: number; loss: number } {
  if (perspective === 'away') {
    return {
      win: prediction.pAway,
      draw: prediction.pDraw,
      loss: prediction.pHome,
    }
  }
  return {
    win: prediction.pHome,
    draw: prediction.pDraw,
    loss: prediction.pAway,
  }
}

interface Props {
  prediction: MatchPrediction | null
  /**
   * `neutral` = Sieg Heimteam / Unentschieden / Sieg Auswärtsteam.
   * `home`/`away` = Sieg/Unentschieden/Niederlage aus Vereinssicht.
   */
  perspective?: FocusPerspective
  /** Kurzkontext, z. B. „Nächstes Spiel · Köln – Heidenheim · ST 33“ */
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
  const lockedScore =
    homeName && awayName
      ? `${homeName} ${locked?.homeGoals}:${locked?.awayGoals} ${awayName}`
      : locked
        ? `${locked.homeGoals}:${locked.awayGoals}`
        : ''

  const bars =
    perspective === 'neutral'
      ? ([
          [
            'home',
            homeName ? `Sieg ${homeName}` : 'Heimsieg',
            outcome1x2(prediction).home,
          ],
          ['draw', 'Unentschieden', outcome1x2(prediction).draw],
          [
            'away',
            awayName ? `Sieg ${awayName}` : 'Auswärtssieg',
            outcome1x2(prediction).away,
          ],
        ] as const)
      : (() => {
          const o = outcomeFromFocus(prediction, perspective)
          return [
            ['win', 'Sieg', o.win],
            ['draw', 'Unentschieden', o.draw],
            ['loss', 'Niederlage', o.loss],
          ] as const
        })()

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
          von dir gesetzt: <strong>{lockedScore}</strong>
        </p>
      ) : !prediction.reliable ? (
        <p className="hint tight forecast-pending-note">{NOT_ENOUGH_DATA_LABEL}</p>
      ) : (
        <>
          <ul className="match-prediction-bars">
            {bars.map(([key, label, p]) => {
              const value = pct(p)
              const tone =
                key === 'home' || key === 'win'
                  ? 'win'
                  : key === 'away' || key === 'loss'
                    ? 'loss'
                    : 'draw'
              return (
                <li key={key} className={`match-prediction-row tone-${tone}`}>
                  <span className="match-prediction-label">{label}</span>
                  <span className="match-prediction-pct">{value}%</span>
                  <div className="forecast-bar" aria-hidden>
                    <span
                      className={`forecast-fill match-fill-${tone}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="hint tight match-prediction-disclaimer">
            Modellschätzung, keine Vorhersage · kein Tipp / keine Quote
          </p>
        </>
      )}
    </div>
  )
}
