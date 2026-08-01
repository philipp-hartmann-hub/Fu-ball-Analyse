import { LEAGUES, type LeagueId } from '../leagues'

interface Props {
  leagueId: LeagueId
  season: number
  seasons: number[]
  onLeagueChange: (id: LeagueId) => void
  onSeasonChange: (season: number) => void
}

export function LeagueSwitcher({
  leagueId,
  season,
  seasons,
  onLeagueChange,
  onSeasonChange,
}: Props) {
  return (
    <div className="switcher">
      <div className="segmented" role="tablist" aria-label="Liga">
        {LEAGUES.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={leagueId === l.id}
            className={leagueId === l.id ? 'active' : ''}
            onClick={() => onLeagueChange(l.id)}
          >
            {l.shortLabel}
          </button>
        ))}
      </div>
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
