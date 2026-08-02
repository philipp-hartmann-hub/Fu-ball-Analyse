import {
  DEFAULT_SIMULATIONS,
  HOME_ADVANTAGE,
} from '../lib/simulation'
import {
  AWAY_WEIGHT,
  HOME_WEIGHT,
  MIN_GAMES_FOR_HARDNESS,
} from '../lib/schedule'

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
      <h3>4. Was du in der Tabelle siehst</h3>
      <p>
        Pro Verein die <strong>Zone mit der höchsten Wahrscheinlichkeit</strong>, der Prozentwert
        und ein Balken. Tooltip: Median-Rang und erwartete Punkte. Die Ansicht „Spanne“ bleibt die
        rein rechnerische Best-/Schlechtfall-Spanne ohne Zufall.
      </p>
      <p className="modal-footnote">
        Vereinfachtes Modell (u. a. keine Formkurven, Verletzungen, Motivation). Bei Saisonstart mit
        0 Spielen sind die Stärken noch weitgehend neutral – die Werte werden aussagekräftiger,
        sobald Spiele gespielt sind.
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
        (Enumeration). Daraus ergeben sich der beste und der schlechteste mögliche Tabellenplatz{' '}
        <strong>nach diesem Spieltag</strong>.
      </p>
      <h3>Gesamte Saison</h3>
      <p>
        Für alle Restspiele wird eine <strong>Heuristik</strong> genutzt: Im Bestfall gewinnt der
        Fokusverein möglichst oft, Gegner holen ungünstig; im Schlechtfall umgekehrt. Das ist eine
        Näherung, keine vollständige Enumeration aller Saisonverläufe.
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
      <h3>Index 0–100 und Rang</h3>
      <p>
        Innerhalb der Liga wird der Rohwert linear skaliert (leichtestes Restprogramm → 0,
        schwerstes → 100). Rang 1 = schwerstes Programm. Sind alle Rohwerte praktisch gleich
        (Rundungsrauschen), liegen alle bei 50 – kein Schein-Ranking.
      </p>
      <h3>Wann die Zahl gilt</h3>
      <p>
        Solange der Median der gespielten Spiele unter {MIN_GAMES_FOR_HARDNESS} liegt, ist PPG zu
        verrauscht. Dann zeigt die UI <strong>„noch keine Aussage“</strong> – kein leicht/schwer und
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
        Die Bedingungs-Analyse zerlegt den Best- bzw. Schlechtfall-Raum in{' '}
        <strong>was fest sein muss</strong> und <strong>was egal ist</strong> – kein einzelner
        Beispielweg und keine nackte Konstellations-Zählung.
      </p>
      <h3>Nächster Spieltag (exakt)</h3>
      <p>
        Aus allen Ergebnis-Kombinationen, die den Best- bzw. Schlechtfall-Platz erreichen, wird
        pro Spiel geprüft: Kommt in <em>jedem</em> dieser Wege derselbe Ausgang vor, ist er{' '}
        <strong>notwendig</strong>. Variieren die Ausgänge, ist das Spiel <strong>egal</strong>.
        Dein eigenes Spiel steht separat als Vorgabe (im Bestfall bevorzugt Sieg, im Schlechtfall
        Niederlage).
      </p>
      <p>
        „Muss passieren“ heißt nur: gilt in jedem optimalen Weg bei dieser Vorgabe. Es sagt nichts
        darüber, ob alle egalen Spiele beliebig kombinierbar sind.
      </p>
      <h3>Gesamte Saison (heuristisch)</h3>
      <p>
        Zu viele Restspiele für eine volle Enumeration. Stattdessen: eigenes Restprogramm als
        Vorgabe (alles siegen bzw. verlieren), Konkurrenten in Tabellen-Reichweite vs. Spiele ohne
        Einfluss – klar als Schätzung gekennzeichnet.
      </p>
      <p className="modal-footnote">
        „Als Szenario übernehmen“ setzt nur Vorgabe und notwendige Fremdergebnisse im Simulator;
        egale Spiele bleiben offen.
      </p>
    </>
  )
}
