import type { LeagueZoneId } from '../lib/table'
import { ZONE_LEGEND_BL1, ZONE_LEGEND_BL2 } from '../lib/table'

interface Props {
  league: LeagueZoneId
}

export function ZoneLegend({ league }: Props) {
  const items = league === 'bl2' ? ZONE_LEGEND_BL2 : ZONE_LEGEND_BL1
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
