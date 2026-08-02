import { useEffect, useRef } from 'react'
import {
  EXPLAIN_TITLES,
  explainBody,
  type ExplainTopic,
} from '../lib/modelExplanations'

interface Props {
  topic: ExplainTopic | null
  onClose: () => void
}

export function ExplainModal({ topic, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = topic != null

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
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
  }, [open, onClose])

  if (!topic) return null

  const title = EXPLAIN_TITLES[topic]
  const titleId = `explain-title-${topic}`

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
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
        <div className="modal-body">{explainBody(topic)}</div>
        <div className="modal-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Verstanden
          </button>
        </div>
      </div>
    </div>
  )
}
