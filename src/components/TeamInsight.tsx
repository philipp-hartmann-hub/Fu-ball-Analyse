import { useMemo, useState } from 'react'
import type { LeagueZoneId } from '../lib/table'
import type { NextMatchdayOutlook, PositionRange, StandingRow } from '../types'
import { zoneLabelFor } from '../lib/table'

type OutlookMode = 'next' | 'season'

interface Props {
  team: StandingRow | null
  seasonRange: PositionRange | null
  nextMatchday: NextMatchdayOutlook | null
  remainingCount: number
  league: LeagueZoneId
  pointsToFirst?: number | null
  pointsAboveRelegation?: number | null
  onEnableMatchdayCutoff?: (matchday: number) => void
  suggestedCutoff?: number | null
}

function RangeCard({
  range,
  league,
}: {
  range: PositionRange
  league: LeagueZoneId
}) {
  const same = range.bestRank === range.worstRank
  return (
    <div className="range-card">
      <div>
        <span className="label">Bestfall</span>
        <strong>{range.bestRank}.</strong>
        <span className="sub">{zoneLabelFor(range.bestRank, league)}</span>
      </div>
      <div className="divider" />
      <div>
        <span className="label">Schlechtfall</span>
        <strong>{range.worstRank}.</strong>
        <span className="sub">{zoneLabelFor(range.worstRank, league)}</span>
      </div>
      {same && (
        <p className="range-same-hint">Platz fest – keine offenen Spiele in dieser Sicht</p>
      )}
    </div>
  )
}

export function TeamInsight({
  team,
  seasonRange,
  nextMatchday,
  remainingCount,
  league,
  pointsToFirst,
  pointsAboveRelegation,
  onEnableMatchdayCutoff,
  suggestedCutoff,
}: Props) {
  const [mode, setMode] = useState<OutlookMode>('next')

  const activeRange = useMemo(() => {
    if (mode === 'next') return nextMatchday?.range ?? null
    return seasonRange
  }, [mode, nextMatchday, seasonRange])

  if (!team) {
    return (
      <div className="panel insight">
        <h2>Vereinsanalyse</h2>
        <p className="hint">
          Wähle einen Verein in der Tabelle – dann siehst du Best-/Schlechtfall für den{' '}
          <strong>nächsten Spieltag</strong> und fürs <strong>Saisonende</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="panel insight">
      <div className="insight-head">
        {team.teamIconUrl ? (
          <img src={team.teamIconUrl} alt="" width={40} height={40} />
        ) : (
          <span className="crest-fallback large" aria-hidden />
        )}
        <div>
          <h2>{team.teamName}</h2>
          <p className="meta">
            Platz {team.rank} · {team.points} Pkt. · {team.won}S {team.draw}U {team.lost}N ·{' '}
            {remainingCount} Restspiele
          </p>
        </div>
      </div>

      <div className="stat-row">
        <div>
          <span className="label">Aktuelle Zone</span>
          <strong>{zoneLabelFor(team.rank, league)}</strong>
        </div>
        {pointsToFirst != null && pointsToFirst > 0 && (
          <div>
            <span className="label">Rückstand Platz 1</span>
            <strong>{pointsToFirst} Pkt.</strong>
          </div>
        )}
        {pointsAboveRelegation != null && (
          <div>
            <span className="label">Vorsprung Platz 16</span>
            <strong>
              {pointsAboveRelegation >= 0 ? `+${pointsAboveRelegation}` : pointsAboveRelegation}{' '}
              Pkt.
            </strong>
          </div>
        )}
      </div>

      <div className="outlook-switch" role="tablist" aria-label="Analysehorizont">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'next'}
          className={mode === 'next' ? 'active' : ''}
          onClick={() => setMode('next')}
        >
          Nächster Spieltag
          {nextMatchday ? ` (${nextMatchday.matchday})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'season'}
          className={mode === 'season' ? 'active' : ''}
          onClick={() => setMode('season')}
        >
          Saisonende
        </button>
      </div>

      {mode === 'next' && nextMatchday && activeRange && (
        <>
          <RangeCard range={activeRange} league={league} />
          <p className="hint tight">
            {nextMatchday.plays
              ? `Gegner: ${nextMatchday.opponentName}. Spanne über alle möglichen Ergebnisse des ${nextMatchday.matchday}. Spieltags (${nextMatchday.fixtureCount} Spiele).`
              : `Kein eigenes Spiel an Spieltag ${nextMatchday.matchday} – Platz hängt nur von den anderen ${nextMatchday.fixtureCount} Partien ab.`}
          </p>
        </>
      )}

      {mode === 'next' && !nextMatchday && (
        <div className="outlook-empty">
          <p>
            Aktuell kein offener Spieltag – die Saison ist durch oder noch ohne Restprogramm in
            dieser Sicht.
          </p>
          {suggestedCutoff != null && onEnableMatchdayCutoff && (
            <button
              type="button"
              className="ghost"
              onClick={() => onEnableMatchdayCutoff(suggestedCutoff)}
            >
              Stand nach Spieltag {suggestedCutoff} setzen
            </button>
          )}
          <p className="hint tight">
            Dann siehst du Best-/Schlechtfall für den darauffolgenden Spieltag.
          </p>
        </div>
      )}

      {mode === 'season' && seasonRange && (
        <>
          <RangeCard range={seasonRange} league={league} />
          <p className="hint tight">
            Über das gesamte Restprogramm: eigener Verein max./min. Punkte, übrige Partien
            heuristisch.
          </p>
        </>
      )}

      {mode === 'season' && !seasonRange && (
        <p className="hint">Keine Spanne berechenbar.</p>
      )}
    </div>
  )
}
