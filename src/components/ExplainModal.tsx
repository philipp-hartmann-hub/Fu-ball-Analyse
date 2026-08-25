import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  EXPLAIN_TITLES,
  type ExplainTopic,
} from '../lib/modelExplanations'
import {
  DecisionsExplainBody,
  ForecastExplainBody,
  HardnessExplainBody,
  MatchPredictionExplainBody,
  SpanExplainBody,
} from './explainBodies'

interface Props {
  topic: ExplainTopic | null
  onClose: () => void
}

function ExplainContent({ topic }: { topic: ExplainTopic }) {
  switch (topic) {
    case 'forecast':
      return <ForecastExplainBody />
    case 'span':
      return <SpanExplainBody />
    case 'hardness':
      return <HardnessExplainBody />
    case 'decisions':
      return <DecisionsExplainBody />
    case 'matchPrediction':
      return <MatchPredictionExplainBody />
  }
}

export function ExplainModal({ topic, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const open = topic != null

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    panelRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, topic])

  if (!topic || typeof document === 'undefined') return null

  const title = EXPLAIN_TITLES[topic]
  const titleId = `explain-title-${topic}`

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            ref={closeRef}
            type="button"
            className="ghost modal-close"
            onClick={onClose}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <ExplainContent topic={topic} />
        </div>
        <div className="modal-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Verstanden
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
