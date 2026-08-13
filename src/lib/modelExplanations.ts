/** Alle UI-Stellen mit Modell-/Heuristik-Rechnung. */
export type ExplainTopic =
  | 'forecast'
  | 'span'
  | 'thresholds'
  | 'hardness'
  | 'conditions'
  | 'decisions'

export const EXPLAIN_TITLES: Record<ExplainTopic, string> = {
  forecast: 'So funktioniert die Prognose',
  span: 'So funktioniert „Möglich“',
  thresholds: 'So entstehen Punktschwellen',
  hardness: 'So entsteht die Restprogramm-Härte',
  conditions: 'Was muss passieren?',
  decisions: 'So funktioniert das Entscheidungs-Radar',
}
