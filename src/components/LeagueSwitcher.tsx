import {
  COMPETITION_GROUPS,
  COMPETITIONS,
  hasFootballDataToken,
  type Competition,
} from '../competitions'

interface Props {
  competitionId: string
  season: number
  seasons: number[]
  onCompetitionChange: (id: string) => void
  onSeasonChange: (season: number) => void
}

export function LeagueSwitcher({
  competitionId,
  season,
  seasons,
  onCompetitionChange,
  onSeasonChange,
}: Props) {
  const needsToken = !hasFootballDataToken()

  return (
    <div className="switcher">
      <label className="comp-label">
        Wettbewerb
        <select
          value={competitionId}
          onChange={(e) => onCompetitionChange(e.target.value)}
          aria-label="Wettbewerb"
        >
          {COMPETITION_GROUPS.map((group) => (
            <optgroup key={group.kind} label={group.label}>
              {COMPETITIONS.filter((c) => c.kind === group.kind).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {optionSuffix(c, needsToken)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="season-label">
        Saison
        <select
          value={season}
          onChange={(e) => onSeasonChange(Number(e.target.value))}
          aria-label="Saison"
        >
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}/{s + 1}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function optionSuffix(c: Competition, needsToken: boolean): string {
  if (!needsToken) return ''
  if (c.preferredProvider === 'football-data' && !c.openligaShortcut) {
    return ' (Token nötig)'
  }
  if (c.preferredProvider === 'football-data') {
    return ' (Token empfohlen)'
  }
  return ''
}
