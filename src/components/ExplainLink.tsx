import type { ExplainTopic } from '../lib/modelExplanations'

interface Props {
  topic: ExplainTopic
  onExplain: (topic: ExplainTopic) => void
  children?: string
  className?: string
}

/** Einheitlicher Einstieg in Modell-Erklärungen. */
export function ExplainLink({
  topic,
  onExplain,
  children = 'Modell erklären',
  className,
}: Props) {
  return (
    <button
      type="button"
      className={['linkish', className].filter(Boolean).join(' ')}
      onClick={(e) => {
        e.stopPropagation()
        onExplain(topic)
      }}
    >
      {children}
    </button>
  )
}
