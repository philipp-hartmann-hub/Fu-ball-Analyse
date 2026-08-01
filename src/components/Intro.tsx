import { useEffect, useState } from 'react'
import './Intro.css'

interface Props {
  onDone: () => void
}

const TABLE_ROWS = [
  { rank: 1, pts: 12, w: 88 },
  { rank: 2, pts: 10, w: 74 },
  { rank: 3, pts: 9, w: 66 },
  { rank: 4, pts: 8, w: 58 },
  { rank: 5, pts: 7, w: 50 },
  { rank: 6, pts: 6, w: 42 },
] as const

export function Intro({ onDone }: Props) {
  const [phase, setPhase] = useState<'play' | 'out'>('play')
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)

    const playMs = mq.matches ? 1600 : 3600
    const doneMs = mq.matches ? 2100 : 4100

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
      <div className="intro-scene" aria-hidden>
        <div className="intro-sky" />
        <div className="intro-rim" />

        <div className="intro-flight">
          <div className="intro-stands">
            <span className="seat-band seat-far" />
            <span className="seat-band seat-left" />
            <span className="seat-band seat-right" />
          </div>

          <div className="intro-pitch">
            <div className="intro-pitch-inner">
              <div className="intro-stripes" />
              <div className="intro-line mid" />
              <div className="intro-circle" />
              <div className="intro-box pen" />
              <div className="intro-box six" />
              <div className="intro-spot" />

              <div className="intro-goal">
                <span className="post left" />
                <span className="post right" />
                <span className="bar" />
                <span className="net" />
              </div>

              <div className="intro-ball">
                <span className="intro-ball-core" />
              </div>
            </div>
          </div>
        </div>

        <div className="intro-vignette" />
      </div>

      <div className="intro-bloom" aria-hidden>
        <div className="intro-flash" />
        <div className="intro-table">
          <div className="intro-table-head">Tabelle</div>
          {TABLE_ROWS.map((row, i) => (
            <div
              key={row.rank}
              className="intro-table-row"
              style={{ ['--i' as string]: String(i), ['--w' as string]: `${row.w}%` }}
            >
              <span className="intro-table-rank">{row.rank}.</span>
              <span className="intro-table-bar" />
              <span className="intro-table-pts">{row.pts}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="intro-copy">
        <p className="intro-eyebrow">Bundesliga · Live</p>
        <h1 className="intro-brand">Tabellenblick</h1>
        <p className="intro-tag">Vom Anstoß bis zur Tabelle.</p>
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
