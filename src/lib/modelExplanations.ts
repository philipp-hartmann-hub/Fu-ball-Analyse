/** Alle UI-Stellen mit Modell-/Heuristik-Rechnung. */
export type ExplainTopic =
  | 'forecast'
  | 'span'
  | 'thresholds'
  | 'hardness'
  | 'conditions'

export const EXPLAIN_TITLES: Record<ExplainTopic, string> = {
  forecast: 'So funktioniert die Prognose',
  span: 'So funktioniert die Platz-Spanne',
  thresholds: 'So entstehen Punktschwellen',
  hardness: 'So entsteht die Restprogramm-Härte',
  conditions: 'So entsteht die Bedingungs-Analyse',
}
