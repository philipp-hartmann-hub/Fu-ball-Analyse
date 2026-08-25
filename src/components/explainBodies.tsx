/** Erklärtexte — feste Formulierungen, nicht frei umschreiben. */

export function ForecastExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Die Prognose schätzt, wie wahrscheinlich jeder Endplatz bzw. jede Zone
        ist — zum Beispiel „60% Abstieg“.
      </p>
      <p>
        Dafür spielen wir die restliche Saison sehr oft (10.000-mal) mit
        zufälligen, aber plausiblen Ergebnissen durch und zählen aus, wie oft
        welcher Platz herauskommt.
      </p>
      <p>
        Wie viele Tore ein Team wahrscheinlich erzielt, schätzen wir aus den
        bisherigen Ergebnissen der Saison — und zwar korrigiert danach, gegen
        wen gespielt wurde: Tore gegen starke Abwehren zählen mehr als Tore
        gegen schwache.
      </p>
      <p>
        Früh in der Saison gibt es dafür noch wenig Daten, deshalb ist die
        Prognose dann vorsichtiger und näher am Mittelfeld. Es ist eine
        Modellschätzung, keine Vorhersage — Verletzungen, Form oder Transfers
        kennt das Modell nicht.
      </p>
    </>
  )
}

export function SpanExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Hier siehst du, welche Plätze ein Verein am Saisonende noch erreichen
        kann — vom bestmöglichen bis zum schlechtestmöglichen.
      </p>
      <p>
        Die meiste Zeit der Saison zeigen wir eine garantierte Obergrenze
        („rechnerisch“): Diese Plätze sind sicher noch drin, schlechter oder
        besser geht rechnerisch nicht.
      </p>
      <p>
        Sobald für einen Verein nur noch wenige entscheidende Spiele offen sind,
        rechnen wir jede Ergebnis-Kombination durch und zeigen die exakte Spanne
        („exakt“). Das passiert nicht ab einem festen Spieltag, sondern sobald
        es die Tabellenlage erlaubt — deshalb steht bei manchen Vereinen früher
        „exakt“ als bei anderen.
      </p>
      <p>
        Grundlage sind nur Punkte und Tordifferenz, kein
        Wahrscheinlichkeits-Modell — die Aussage ist also garantiert, nicht
        geschätzt.
      </p>
    </>
  )
}

export function HardnessExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Diese Einstufung sagt, wie schwer die verbleibenden Spiele{' '}
        <strong>für diesen Verein</strong> sind — von „sehr leicht“ bis „sehr
        schwer“.
      </p>
      <p>
        Wir schauen für jedes Restspiel, wie wahrscheinlich der Verein gegen
        genau diesen Gegner punktet, und fassen das zu einer Stufe zusammen.
        „Schwer“ heißt also: Gegner, gegen die dieser Verein voraussichtlich
        wenig holt.
      </p>
      <p>
        Es geht um die tatsächliche Schwere für den Verein, nicht um einen
        Vergleich mit dem Ligaschnitt. Modellschätzung, gleiche Grundlage wie die
        Prognose.
      </p>
    </>
  )
}

export function DecisionsExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Hier siehst du, was für einen Verein über die <strong>gesamte</strong>{' '}
        Saison schon feststeht — zum Beispiel „gerettet“, „aufgestiegen“ oder
        „Abstieg besiegelt“.
      </p>
      <p>
        Diese Aussagen sind garantiert: Sie kommen aus derselben rechnerischen
        Grenze wie die möglichen Plätze, gelten also für die ganze restliche
        Saison, nicht nur für den nächsten Spieltag.
      </p>
      <p>
        Bei benannten Schwellen (z. B. „Klassenerhalt ab X Punkten“) steht
        dabei, wie viele Punkte noch fehlen. Läuft gerade ein Spiel, zeigen wir
        zusätzlich, was der aktuelle Zwischenstand daran ändert. Rein passiv —
        keine Benachrichtigungen.
      </p>
    </>
  )
}

export function MatchPredictionExplainBody() {
  return (
    <>
      <p className="modal-lead">
        Die Spielschätzung gibt die Wahrscheinlichkeit für Sieg, Unentschieden
        und Niederlage eines einzelnen Spiels an.
      </p>
      <p>
        Sie beruht auf derselben Torschätzung wie die Prognose (bisherige
        Ergebnisse, korrigiert nach Gegnerstärke). Modellschätzung, keine
        Wettberatung.
      </p>
    </>
  )
}
