import {
  DEFAULT_SIMULATIONS,
  HOME_ADVANTAGE,
  MATCH_LEAN_LIKELY_THRESHOLD,
} from '../lib/simulation'
import { FOCUS_EXTREME_MARGIN } from '../lib/scenarios'
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
        Die <strong>Prognose</strong> ist eine Schätzung aus vielen Zufallsverläufen – keine
        Vorhersage und keine Wett-Tipp.
      </p>
      <h3>Wie stark ist ein Team?</h3>
      <p>
        Aus der Tabelle: wie viele Tore ein Team im Schnitt schießt und kassiert. Teams ohne
        Spiele gelten als durchschnittlich. Heimteams bekommen einen kleinen Bonus ({homeLabel}{' '}
        Tore).
      </p>
      <h3>Restspiele durchspielen</h3>
      <p>
        Jedes offene Spiel wird zufällig entschieden – stärkerer Angriff gegen schwächere Abwehr
        erhöht die Chance auf Tore. Von dir gesetzte Szenarien bleiben fest und werden nicht neu
        gewürfelt.
      </p>
      <h3>Viele Saisons</h3>
      <p>
        Das machen wir {runsLabel}-mal. Pro Durchlauf entsteht eine Endtabelle. Danach zählen wir,
        wie oft ein Team Meister, CL, Europa oder Abstieg (bzw. Aufstieg in der 2./3. Liga)
        erreicht.
      </p>
      <h3>Was du siehst</h3>
      <p>
        In der <strong>Tabelle</strong>: die Zone mit der höchsten Wahrscheinlichkeit plus
        Prozentbalken. Im Tooltip: typischer Platz und erwartete Punkte.
      </p>
      <p>
        Unter <strong>Verein</strong>: alle Zonen mit Wahrscheinlichkeit, dazu die Schätzung fürs
        nächste eigene Spiel (Sieg / Unentschieden / Niederlage). Im Restprogramm erscheint je
        Gegner nur der <strong>wahrscheinlichste</strong> Ausgang als Text (z. B. „Sieg
        möglich“) — Details zur Einstufung im eigenen Erklär-Popup. Im{' '}
        <strong>Vergleich</strong> dasselbe Modell als Kürzel <strong>S / U / N</strong>. Duell
        und nächstes Spiel bleiben mit vollen Balken.
      </p>
      <p>
        Die Ansicht <strong>Möglich</strong> ist etwas anderes: dort geht es nur um „was ist
        überhaupt noch drin?“ – ohne Zufall und ohne Prozent.
      </p>
      <h3>Wann die Zahlen fehlen</h3>
      <p>
        Ganz am Saisonanfang (weniger als {MIN_GAMES} Spiele im Schnitt) sind die Stärken noch zu
        unsicher. Dann zeigt die App keine Prozentwerte, sondern „noch keine Aussage“.
      </p>
      <p className="modal-footnote">
        Vereinfachtes Modell – ohne Formkurve, Verletzungen oder Motivation.
      </p>
    </>
  )
}

export function SpanExplainBody() {
  return (
    <>
      <p className="modal-lead">
        <strong>Möglich</strong> zeigt, welche Plätze für einen Verein <em>noch drin</em> sind –
        der beste und der schlechteste denkbare Platz. Keine Wahrscheinlichkeit, nur die
        Bandbreite.
      </p>
      <h3>Nächster Spieltag</h3>
      <p>
        Alle offenen Spiele dieses Spieltags werden in den Varianten Sieg / Unentschieden /
        Niederlage durchgespielt. Bei Fremdspielen reichen knappe Ergebnisse (1:0, 1:1, 0:1). Beim{' '}
        <strong>eigenen</strong> Spiel rechnen wir mit großer Tordifferenz (bis{' '}
        {FOCUS_EXTREME_MARGIN}:0), damit ein knapper Sieg den Platz nicht unterschätzt. Daraus
        kommen bester und schlechtester Platz <strong>nach diesem Spieltag</strong> – und was dafür
        passieren muss.
      </p>
      <h3>Gesamte Saison</h3>
      <p>
        Es zählen nur Spiele, die für den Platz des Vereins noch etwas ändern können: Teams, die
        ihn punktemäßig noch einholen oder von ihm eingeholt werden können. Spiele ganz oben oder
        ganz unten, die ihn nicht mehr erreichen, fallen weg. Deshalb ist die Grenze{' '}
        <strong>pro Verein unterschiedlich</strong> – nicht „ab Spieltag X“.
      </p>
      <p>
        Sind für einen Verein höchstens 12 solcher Spiele offen, rechnen wir alle Kombinationen
        durch (Badge <strong>exakt</strong>). Sonst eine sichere Obergrenze aus den maximal noch
        erreichbaren Punkten (Badge <strong>rechnerisch</strong>): Wer dich sicher überholt bzw.
        sicher nicht mehr einholt, begrenzt den Platz. Der echte Endplatz liegt immer in diesem
        Bereich; mit jedem weiteren Ergebnis wird er höchstens enger, nie weiter.
      </p>
      <h3>Unterschied zur Prognose</h3>
      <p>
        Die Prognose sagt: „Wie oft landet das Team dort?“ Die Spanne sagt nur: „Ist der Platz
        überhaupt noch möglich?“ – auch bei sehr unwahrscheinlichen Verläufen.
      </p>
      <p className="modal-footnote">
        Gesetzte Szenarien und „Stand nach Spieltag“ fließen mit ein.
      </p>
    </>
  )
}

export function ThresholdsExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Punktschwellen sagen, ab wie vielen Punkten ein Ziel (z. B. Klassenerhalt) in der
        betrachteten Sicht noch erreichbar ist – oder schon sicher. Keine Wahrscheinlichkeiten.
      </p>
      <h3>Nach dem nächsten Spieltag</h3>
      <p>
        Das ist der <strong>Tabellenplatz nach diesem Spieltag</strong>, kein
        Saison-Urteil. Sätze wie „Aufstiegsplatz ab X Punkten“ oder „kein
        Abstiegsplatz“ gelten nur für die Tabelle nach den heutigen Spielen.
        Sind Zielplatz <em>und</em> Abstiegsplatz in dieser Enumeration beide
        noch möglich, zeigen wir bewusst keine Punktzahl.
      </p>
      <h3>Gesamte Saison</h3>
      <p>
        Über die ganze Saison gibt es nur Best- und Schlechtfall. Daraus bauen wir{' '}
        <strong>keine</strong> „ab X Punkten“-Zahlen (die wären irreführend). Stattdessen kurze
        Hinweise zum Extremfall – oder gar nichts, wenn Ziel und Abstieg beide noch offen sind.
      </p>
      <p className="modal-footnote">
        „Rechnerisch sicher“ heißt: in allen betrachteten Ausgängen dieser Sicht. Das ist keine
        Garantie für die echte Saison.
      </p>
    </>
  )
}

export function HardnessExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Das Restprogramm zeigt als Stufe, wie schwer die verbleibenden Spiele{' '}
        <strong>für diesen Verein</strong> sind — nicht relativ zur Liga, und
        ohne Punktezahl in der Anzeige.
      </p>
      <h3>Rechnung (intern)</h3>
      <p>
        Pro Restspiel dieselbe Poisson-Schätzung wie bei der Spielschätzung:
        erwartete Punkte = P(Sieg)×3 + P(Remis)×1. Der Mittelwert über die
        Restspiele steckt die absolute Skala (0…3 Punkte/Spiel).
      </p>
      <h3>Fünf Stufen</h3>
      <p>
        Daraus:{' '}
        <strong>sehr leicht</strong>, <strong>leicht</strong>,{' '}
        <strong>mittel</strong>, <strong>schwer</strong>,{' '}
        <strong>sehr schwer</strong>. Die Grenzen sind feste
        Punkte-pro-Spiel-Schwellen — nicht der eigene Saisonschnitt. So wird ein
        schwaches Team mit schweren Gegnern nicht fälschlich „leicht“, nur weil
        es ohnehin wenig Punkte holt.
      </p>
      <h3>Konsistenz mit Einzelspielen</h3>
      <p>
        Sind die meisten Restspiele „Niederlage wahrscheinlich“, darf die
        Gesamtstufe nicht leicht oder sehr leicht sein — beides kommt aus demselben
        Modell.
      </p>
      <h3>Wann die Stufe fehlt</h3>
      <p>
        Am Saisonanfang (Median unter {MIN_GAMES} Spielen) sind die Stärken noch
        zu unsicher. Dann zeigt die App <strong>„noch keine Aussage“</strong>.
      </p>
      <p className="modal-footnote">
        Modellschätzung wie Prognose und Spielschätzung – keine Vorhersage und
        kein Tipp.
      </p>
    </>
  )
}

export function MatchLeanExplainBody() {
  const pct = Math.round(MATCH_LEAN_LIKELY_THRESHOLD * 100)
  return (
    <>
      <p className="modal-lead">
        Im Restprogramm steht je Gegner nur der <strong>Favoriten-Ausgang</strong>{' '}
        aus Vereinssicht — ohne Prozentzahl, damit die Liste lesbar bleibt.
      </p>
      <h3>Was die Labels bedeuten</h3>
      <ul>
        <li>
          <strong>… wahrscheinlich</strong> — dieser Ausgang (Sieg, Unentschieden
          oder Niederlage) hat im Modell mindestens {pct}&nbsp;% und ist zugleich der
          höchste der drei.
        </li>
        <li>
          <strong>… möglich</strong> — derselbe Ausgang ist der höchste, liegt aber
          unter {pct}&nbsp;% (knappe Favoritenrolle).
        </li>
      </ul>
      <h3>Woher die Einschätzung kommt</h3>
      <p>
        Dieselbe Poisson-1X2-Schätzung wie bei der Spielschätzung fürs nächste
        Spiel — nur dass wir hier den stärksten der drei Ausgänge zeigen, nicht
        alle drei Balken. Heim- und Auswärtsspiele stecken in den Tor-Erwartungen.
      </p>
      <h3>Vergleich</h3>
      <p>
        Dort erscheint dasselbe Modell nur als <strong>S / U / N</strong> neben dem
        Gegner-Kürzel. Die ausführliche Spielschätzung mit Balken bleibt beim
        direkten Duell und beim nächsten Spiel.
      </p>
      <p className="modal-footnote">
        Modellschätzung, keine Vorhersage · kein Tipp / keine Quote.
      </p>
    </>
  )
}

export function ConditionsExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Beim <strong>nächsten Spieltag</strong> kannst du sehen, was für Best- oder Schlechtfall
        passieren muss: Muss / Darf nicht / egal – und ggf. eine Mindest-Tordifferenz.
      </p>
      <h3>Nächster Spieltag</h3>
      <p>
        Wir schauen alle Spieltag-Kombinationen an, die den gewünschten Platz erreichen. Pro
        Fremdspiel gilt dann:
      </p>
      <ul>
        <li>
          <strong>Muss</strong> — nur dieses Ergebnis führt zum Ziel
        </li>
        <li>
          <strong>Darf nicht</strong> — genau ein Ergebnis würde den Platz verhindern
        </li>
        <li>
          <strong>Wirklich egal</strong> — Sieg, Unentschieden und Niederlage kommen alle vor
        </li>
      </ul>
      <p>
        Dein eigenes Spiel steht separat. Bei Sieg oder Niederlage kann eine{' '}
        <strong>Mindest-Tordifferenz</strong> nötig sein (z. B. mind. +6), wenn 1:0 für den Platz
        nicht reicht.
      </p>
      <h3>Gesamte Saison</h3>
      <p>
        Nur die Platzspanne – keine „was muss passieren?“-Liste. Dafür wären zu viele Spiele offen,
        und die Aussage wäre oft irreführend.
      </p>
      <p className="modal-footnote">
        „Als Szenario übernehmen“ setzt die nötigen Ergebnisse; offene Spiele bleiben frei.
      </p>
    </>
  )
}

export function DecisionsExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Das <strong>Entscheidungs-Radar</strong> trennt klar: was für die{' '}
        <strong>Saison</strong> feststeht, und was sich an einem{' '}
        <strong>Spieltag</strong> entscheiden kann. Passiv, ohne Alerts.
      </p>
      <h3>Saison-Status (garantiert)</h3>
      <p>
        Labels wie „Gerettet (Saison steht fest)“ kommen aus den harten Platzgrenzen
        über <em>alle</em> Restspiele. Das ist keine Aussage nur für heute — der
        Endplatz der Saison liegt immer in dieser Grenze.
      </p>
      <h3>Live → Saison-Folge</h3>
      <p>
        Läuft ein Spiel, ist der <strong>Zwischenstand der Auslöser</strong>, die
        Konsequenz gilt für die <strong>restliche Saison</strong> (z. B. „für die
        Saison jetzt gerettet“). Ohne laufende Spiele erscheint dieser Block nicht.
      </p>
      <h3>Auslöser: Spieltag vs. Saison</h3>
      <p>
        <strong>Spieltag</strong>: relevante Zonen aus der Enumeration aller
        Partien — Tabellenführer, CL/EL/ECL bzw. Aufstieg/Relegation, Abstieg.
        Auch wer dort schon steht, erscheint (z. B. „bleibt CL-Platz möglich“).
        Ohne Chance fehlt der Verein in der Liste. Keine Saison-Gewissheit.{' '}
        <strong>Saison</strong>: nur was die harten Grenzen (wie „Möglich“) über
        alle Restspiele hergeben; Clinch-Zeilen nur wenn die Zone noch offen und
        kippbar ist.
      </p>
    </>
  )
}
