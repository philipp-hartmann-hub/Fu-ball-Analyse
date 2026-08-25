/** Alle UI-Stellen mit Modell-/Heuristik-Rechnung. */
export type ExplainTopic =
  | 'forecast'
  | 'span'
  | 'hardness'
  | 'decisions'
  | 'matchPrediction'

export const EXPLAIN_TITLES: Record<ExplainTopic, string> = {
  forecast: 'Prognose',
  span: 'Mögliche Plätze',
  hardness: 'Restprogramm',
  decisions: 'Entscheidungen',
  matchPrediction: 'Spielschätzung',
}
