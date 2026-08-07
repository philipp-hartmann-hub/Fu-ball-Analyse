import {
  DEFAULT_SIMULATIONS,
  HOME_ADVANTAGE,
} from '../lib/simulation'
import { FOCUS_EXTREME_MARGIN } from '../lib/scenarios'
import { AWAY_WEIGHT, HOME_WEIGHT } from '../lib/schedule'
import { MIN_GAMES } from '../lib/reliability'

export function ForecastExplainBody() {
  const runsLabel = DEFAULT_SIMULATIONS.toLocaleString('de-DE')
  const homeLabel = HOME_ADVANTAGE.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return (
    <>
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
        Jedes offene Spiel wird per <strong>Poisson-Verteilung</strong> simuliert: Erwartete Tore
        hängen von Angriff des einen und Abwehr des anderen Teams ab. Von dir gesetzte Szenarien
        bleiben unverändert und werden nicht neu gezogen.
      </p>
      <h3>3. Viele Saisonverläufe</h3>
      <p>
        Das passiert {runsLabel}-mal. Pro Lauf entsteht eine Endtabelle. Daraus zählen wir, wie oft
        ein Verein Meister, CL, EL, ECL, Relegation oder Abstieg erreicht (bzw. die Aufstiegszonen
        in der 2. Liga).
      </p>
      <h3>4. Was du siehst</h3>
      <p>
        In der <strong>Tabelle</strong>: pro Verein die Zone mit der höchsten
        Wahrscheinlichkeit, Prozentwert und Balken. Tooltip: Median-Rang und erwartete Punkte.
      </p>
      <p>
        Unter <strong>Vereine</strong>: dieselbe Simulation, aber alle Zonen-Szenarien mit
        Wahrscheinlichkeit (sortiert, Nullen ausgeblendet) plus Median-Rang und erwartete Punkte.
        Zusätzlich die <strong>Spielschätzung</strong> für das nächste eigene Spiel (1/X/2 in
        geschlossener Form aus denselben λ-Werten) – klar als Modellschätzung gekennzeichnet.
        Im <strong>Vergleich</strong> erscheinen Direkt-Duell und optional das nächste Spiel je
        Verein.
      </p>
      <p>
        Die Ansicht „Spanne“ bleibt die rein rechnerische Best-/Schlechtfall-Spanne ohne Zufall.
      </p>
      <h3>Wann die Zahl gilt</h3>
      <p>
        Bei Saisonstart (Median &lt; {MIN_GAMES} Spiele) kollabieren Stärken auf Neutralwerte —
        die UI zeigt dann <strong>keine Zonen-Prozente</strong>, sondern „noch keine Aussage (zu
        wenige Spiele)“. Die Simulation darf trotzdem laufen.
      </p>
      <p className="modal-footnote">
        Vereinfachtes Modell (u. a. keine Formkurven, Verletzungen, Motivation).
      </p>
    </>
  )
}

export function SpanExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Die Spalte <strong>Möglich</strong> und die Best-/Schlechtfall-Karten zeigen{' '}
        <strong>rechnerische Extreme</strong> – keine Wahrscheinlichkeiten und keine Vorhersage.
      </p>
      <h3>Nächster Spieltag</h3>
      <p>
        Alle offenen Spiele dieses Spieltags werden in den Varianten 1 / X / 2 durchgespielt
        (Enumeration). <strong>Fremdspiele</strong> mit Minimal-Toren (1:0 / 1:1 / 0:1); das{' '}
        <strong>eigene Spiel</strong> mit großzügiger Tordifferenz (bis {FOCUS_EXTREME_MARGIN}
        :0 bzw. 0:{FOCUS_EXTREME_MARGIN}), damit GD-/Tore-Überholmanöver nicht unterschätzt
        werden. Daraus ergeben sich bester und schlechtester Platz{' '}
        <strong>nach diesem Spieltag</strong>, plus Muss-/Darf-nicht-Bedingungen und ggf. eine
        Mindest-Tordifferenz.
      </p>
      <h3>Gesamte Saison</h3>
      <p>
        Zuerst Relevanz-Pruning: nur Teams mit überlappenden Punkte-Intervallen und deren
        Restspiele. Bei höchstens 12 relevanten Spielen:{' '}
        <strong>exakte Enumeration</strong> aller 1/X/2-Kombinationen in einem gemeinsamen
        Durchlauf – widerspruchsfreie Spannen für die ganze Tabelle.
      </p>
      <p>
        Darüber hinaus eine <strong>Heuristik</strong> (innere Näherung
        „mindestens“): Fokus und relevante Rivalen (die den Fokus rechnerisch noch
        einholen bzw. von ihm eingeholt werden können) bekommen große Tor-Margen; sonst
        Minimal-Tore. Die reale Spanne kann breiter sein. Für belastbare Zonen-Anteile
        aller Vereine die <strong>Prognose</strong> (Monte-Carlo) nutzen. Für die Saison
        gibt es bewusst <strong>keine</strong> Pathway- oder Wunschplatz-Bedingungen.
      </p>
      <p>
        Zusätzlich in der Vereinsanalyse: die{' '}
        <strong>mathematisch mögliche Spanne</strong> aus Punktemaxima (äußere Garantie).
        Der echte Endrang liegt immer darin; Exact/Heuristik darunter können enger sein.
        Die Tabellen-Spalte „Möglich“ bleibt Exact bzw. Heuristik.
      </p>
      <h3>Unterschied zur Prognose</h3>
      <p>
        Die Prognose würfelt viele zufällige Verläufe (Poisson). Die Spanne zeigt nur, was{' '}
        <em>überhaupt möglich</em> wäre – auch sehr unwahrscheinliche Extreme.
      </p>
      <p className="modal-footnote">
        Gesetzte Szenarien und der „Stand nach Spieltag“ fließen in die Rechnung ein.
      </p>
    </>
  )
}

export function ThresholdsExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Punktschwellen leiten sich aus möglichen <strong>Punkt-/Rang-Kombinationen</strong> ab –
        nicht aus Wahrscheinlichkeiten.
      </p>
      <h3>Nach dem nächsten Spieltag</h3>
      <p>
        Aus der exakten Enumeration (0 / 1 / 3 Punkte je eigenem Spiel) entstehen Aussagen wie
        „Klassenerhalt ab X Pkt.“ – aber nur, wenn die Schwelle in diesem Spieltag überhaupt
        erreichbar ist (höchstens aktuelle Punkte + 3). Sind Ziel <em>und</em> Abstieg noch beide
        möglich, erscheinen bewusst <strong>keine</strong> Punkt-Zahlen (nichts ist entschieden).
      </p>
      <h3>Gesamte Saison</h3>
      <p>
        Die Saison liefert nur Best- und Schlechtfall. Daraus dürfen{' '}
        <strong>keine „ab X Pkt.“-Zahlen</strong> gebaut werden (die wären Artefakte). Stattdessen
        nur qualitative Extremfall-Aussagen, markiert als Schätzung – oder gar nichts, wenn Ziel und
        Abstieg beide noch möglich sind.
      </p>
      <p className="modal-footnote">
        Labels wie „rechnerisch sicher“ meinen: in allen betrachteten Outcomes des jeweiligen
        Horizonts. Das ist keine Garantie für die echte Saison.
      </p>
    </>
  )
}

export function HardnessExplainBody() {
  const home = HOME_WEIGHT.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const away = AWAY_WEIGHT.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return (
    <>
      <p className="modal-lead">
        Die Restprogramm-Härte schätzt, wie <strong>stark die verbleibenden Gegner</strong> im
        Schnitt sind – relativ zur Liga, nicht absolut.
      </p>
      <h3>Rechnung</h3>
      <p>
        Pro Restspiel: Gegnerstärke = aktuelle <strong>Punkte pro Spiel (PPG)</strong>. Heimspiele
        gewichten den Gegner mit {home}, Auswärtsspiele mit {away}. Mittelwert über alle Restspiele
        → Rohwert.
      </p>
      <h3>Einschätzung und Rang</h3>
      <p>
        Innerhalb der Liga wird der Rohwert linear skaliert (leichtestes Restprogramm → 0,
        schwerstes → 100). Daraus entstehen fünf Stufen:{' '}
        <strong>sehr leicht</strong>, <strong>leicht</strong>, <strong>mittel</strong>,{' '}
        <strong>schwer</strong>, <strong>sehr schwer</strong>. In der Tabelle steht die Stufe;
        Tooltip zeigt Index und Liga-Rang (1 = schwerstes Programm). Sind alle Rohwerte
        praktisch gleich (Rundungsrauschen), liegen alle bei 50 – kein Schein-Ranking.
      </p>
      <h3>Wann die Zahl gilt</h3>
      <p>
        Solange der Median der gespielten Spiele unter {MIN_GAMES} liegt, ist PPG zu
        verrauscht. Dann zeigt die UI <strong>„noch keine Aussage“</strong> – keine Stufe und
        kein Liga-Rang.
      </p>
      <p className="modal-footnote">
        Die Härte sagt nichts über eigene Form oder Saisonziel aus – nur über das Restprogramm.
      </p>
    </>
  )
}

export function ConditionsExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Die Bedingungs-Analyse (nur <strong>nächster Spieltag</strong>) zerlegt den Best- bzw.
        Schlechtfall-Raum in Muss / Darf nicht / egal – plus ggf. Mindest-Tordifferenz.
      </p>
      <h3>Nächster Spieltag (exakt)</h3>
      <p>
        Aus den Kombinationen, die den Zielrang erreichen (nach Filter auf deine Vorgabe und die
        nötige Tordifferenz), wird pro Fremdspiel die Menge der Ausgänge gebildet:
      </p>
      <ul>
        <li>
          <strong>Muss</strong> — nur ein Ausgang in allen optimalen Wegen
        </li>
        <li>
          <strong>Darf nicht</strong> — genau ein Ausgang fehlt („X darf nicht …“)
        </li>
        <li>
          <strong>Wirklich egal</strong> — alle drei Ausgänge kommen vor
        </li>
      </ul>
      <p>
        Dein eigenes Spiel steht separat; bei Sieg/Niederlage kann eine{' '}
        <strong>Mindest-Tordifferenz</strong> stehen (z. B. mind. +6), wenn 1:0 für den Platz
        nicht reicht. Fremdspiele bleiben Minimal-Tore.
      </p>
      <h3>Gesamte Saison</h3>
      <p>
        Nur die Platzspanne – keine Pathway- oder Wunschplatz-Bedingungen (zu viele offene
        Kombinationen, inhaltlich irreführend).
      </p>
      <p className="modal-footnote">
        „Als Szenario übernehmen“ setzt Vorgabe und notwendige Fremdergebnisse; offene Spiele
        bleiben ungesetzt.
      </p>
    </>
  )
}
