import type { LeagueShortcut } from '../types'
import { LEAGUES } from '../api/openliga'

interface Props {
  league: LeagueShortcut
  season: number
  seasons: number[]
  onLeagueChange: (league: LeagueShortcut) => void
  onSeasonChange: (season: number) => void
}

export function LeagueSwitcher({
  league,
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
            key={l.shortcut}
            type="button"
            role="tab"
            aria-selected={league === l.shortcut}
            className={league === l.shortcut ? 'active' : ''}
            onClick={() => onLeagueChange(l.shortcut)}
          >
            {l.label}
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
