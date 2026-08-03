import type { LeagueZoneId } from '../lib/table'
import {
  ZONE_LEGEND_BL1,
  ZONE_LEGEND_BL2,
  ZONE_LEGEND_BL3,
  ZONE_LEGEND_FL1,
  ZONE_LEGEND_TOP5_20,
} from '../lib/table'

interface Props {
  league: LeagueZoneId
}

function legendFor(league: LeagueZoneId) {
  if (league === 'bl3') return ZONE_LEGEND_BL3
  if (league === 'bl2') return ZONE_LEGEND_BL2
  if (league === 'fl1') return ZONE_LEGEND_FL1
  if (league === 'pl' || league === 'pd' || league === 'sa') {
    return ZONE_LEGEND_TOP5_20
  }
  return ZONE_LEGEND_BL1
}

export function ZoneLegend({ league }: Props) {
  const items = legendFor(league)
  return (
    <ul className="zone-legend" aria-label="Tabellenzonen">
      {items.map((item) => (
        <li key={item.zone}>
          <span className={`swatch zone-${item.zone}`} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
