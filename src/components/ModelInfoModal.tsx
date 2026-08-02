import { useEffect, useRef } from 'react'
import {
  DEFAULT_SIMULATIONS,
  HOME_ADVANTAGE,
} from '../lib/simulation'

interface Props {
  open: boolean
  onClose: () => void
}

export function ModelInfoModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

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

  if (!open) return null

  const runsLabel = DEFAULT_SIMULATIONS.toLocaleString('de-DE')
  const homeLabel = HOME_ADVANTAGE.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="model-info-title">So funktioniert die Prognose</h2>
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
          <p className="modal-lead">
            Die Prognose ist eine <strong>Modellschätzung</strong>, keine Vorhersage und keine
            Wettberatung. Sie zeigt, wie oft Teams in Simulationen in bestimmten Zonen landen.
          </p>

          <h3>1. Team-Stärke</h3>
          <p>
            Aus der aktuellen Tabelle: Tore und Gegentore pro Spiel (Angriff / Abwehr). Teams ohne
            Spiele starten mit Neutralwerten. Heimteams bekommen einen leichten Bonus von{' '}
            {homeLabel} erwarteten Toren.
          </p>

          <h3>2. Restspiele würfeln</h3>
          <p>
            Jedes offene Spiel wird per <strong>Poisson-Verteilung</strong> simuliert: Erwartete
            Tore hängen von Angriff des einen und Abwehr des anderen Teams ab. Von dir gesetzte
            Szenarien bleiben unverändert und werden nicht neu gezogen.
          </p>

          <h3>3. Viele Saisonverläufe</h3>
          <p>
            Das passiert {runsLabel}-mal. Pro Lauf entsteht eine Endtabelle. Daraus zählen wir, wie
            oft ein Verein Meister, CL, EL, ECL, Relegation oder Abstieg erreicht (bzw. die
            Aufstiegszonen in der 2. Liga).
          </p>

          <h3>4. Was du in der Tabelle siehst</h3>
          <p>
            Pro Verein die <strong>Zone mit der höchsten Wahrscheinlichkeit</strong>, der Prozentwert
            und ein Balken. Tooltip: Median-Rang und erwartete Punkte. Die Ansicht „Spanne“ bleibt
            die rein rechnerische Best-/Schlechtfall-Spanne ohne Zufall.
          </p>

          <p className="modal-footnote">
            Vereinfachtes Modell (u. a. keine Formkurven, Verletzungen, Motivation). Bei Saisonstart
            mit 0 Spielen sind die Stärken noch weitgehend neutral – die Werte werden aussagekräftiger,
            sobald Spiele gespielt sind.
          </p>
        </div>

        <div className="modal-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Verstanden
          </button>
        </div>
      </div>
    </div>
  )
}
