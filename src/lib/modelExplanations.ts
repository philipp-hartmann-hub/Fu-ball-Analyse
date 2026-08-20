/** Alle UI-Stellen mit Modell-/Heuristik-Rechnung. */
export type ExplainTopic =
  | 'forecast'
  | 'span'
  | 'thresholds'
  | 'hardness'
  | 'conditions'
  | 'decisions'
  | 'matchLean'

export const EXPLAIN_TITLES: Record<ExplainTopic, string> = {
  forecast: 'So funktioniert die Prognose',
  span: 'So funktioniert „Möglich“',
  thresholds: 'So entstehen Punktschwellen',
  hardness: 'So entsteht das Restprogramm (5 Stufen)',
  conditions: 'Was muss passieren?',
  decisions: 'So funktioniert das Entscheidungs-Radar',
  matchLean: 'Sieg möglich / wahrscheinlich – was heißt das?',
}
