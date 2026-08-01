import { useEffect, useState } from 'react'
import './Intro.css'

interface Props {
  onDone: () => void
}

const RANKS = ['18.', '12.', '7.', '3.', '1.'] as const

export function Intro({ onDone }: Props) {
  const [phase, setPhase] = useState<'play' | 'out'>('play')
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)

    // Auch bei reduced motion kurz zeigen – sonst wirkt die Seite „kaputt“ ohne Intro.
    const playMs = mq.matches ? 1800 : 3400
    const doneMs = mq.matches ? 2300 : 4100

    const exitTimer = window.setTimeout(() => setPhase('out'), playMs)
    const doneTimer = window.setTimeout(onDone, doneMs)
    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(doneTimer)
    }
  }, [onDone])

  const finish = () => {
    setPhase('out')
    window.setTimeout(onDone, 400)
  }

  return (
    <div
      className={`intro ${phase === 'out' ? 'intro-out' : ''} ${reduced ? 'intro-reduced' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Tabellenblick Intro"
      onClick={finish}
    >
      <div className="intro-pitch" aria-hidden>
        <div className="intro-stripes" />
        <div className="intro-center-circle" />
        <div className="intro-center-spot" />
        <div className="intro-halfway" />
        <div className="intro-box intro-box-left" />
        <div className="intro-box intro-box-right" />
      </div>

      <div className="intro-ball" aria-hidden>
        <span className="intro-ball-core" />
      </div>

      <ul className="intro-ranks" aria-hidden>
        {RANKS.map((rank) => (
          <li key={rank}>{rank}</li>
        ))}
      </ul>

      <div className="intro-copy">
        <p className="intro-eyebrow">Bundesliga · Live</p>
        <h1 className="intro-brand">Tabellenblick</h1>
        <p className="intro-tag">Wo endet die Saison – und wo stehst du morgen?</p>
      </div>

      <div className="intro-standings" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="intro-row" style={{ ['--i' as string]: String(i) }}>
            <span className="intro-row-rank">{i + 1}</span>
            <span className="intro-row-bar" />
            <span className="intro-row-pts">{(18 - i) * 3}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="intro-skip"
        onClick={(e) => {
          e.stopPropagation()
          finish()
        }}
      >
        Überspringen
      </button>
    </div>
  )
}
