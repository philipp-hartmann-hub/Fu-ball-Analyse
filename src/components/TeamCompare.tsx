import { useMemo } from 'react'
import type { Match, ScenarioResult, StandingRow } from '../types'
import {
  hardnessGrade,
  hardnessGradeLabel,
  type ScheduleHardness,
} from '../lib/schedule'
import {
  deriveMatchLean,
  predictFixture,
  type MatchLean,
} from '../lib/simulation'
import type { ExplainTopic } from '../lib/modelExplanations'
import { ExplainLink } from './ExplainLink'
import { MatchLeanChip } from './MatchLeanChip'
import { MatchPredictionCard } from './MatchPredictionCard'

export interface RemainingFixture {
  matchId: number
  matchday: number
  venue: 'H' | 'A'
  opponentId: number
  opponentName: string
  /** Gegner ist das andere Vergleichsteam */
  isHeadToHead: boolean
}

interface Props {
  standings: StandingRow[]
  remaining: Match[]
  scenarios?: ScenarioResult[]
  hardnessByTeam: Map<number, ScheduleHardness>
  teamAId: number | null
  teamBId: number | null
  onChangeTeamA: (id: number | null) => void
  onChangeTeamB: (id: number | null) => void
  onExplain?: (topic: ExplainTopic) => void
}

function teamLabel(row: StandingRow): string {
  return row.shortName || row.teamName
}

function remainingFixturesFor(
  teamId: number,
  remaining: Match[],
  otherId: number | null,
): RemainingFixture[] {
  const list: RemainingFixture[] = []
  for (const m of remaining) {
    const home = m.team1.teamId === teamId
    const away = m.team2.teamId === teamId
    if (!home && !away) continue
    const opp = home ? m.team2 : m.team1
    list.push({
      matchId: m.matchID,
      matchday: m.group.groupOrderID,
      venue: home ? 'H' : 'A',
      opponentId: opp.teamId,
      opponentName: opp.shortName || opp.teamName,
      isHeadToHead: otherId != null && opp.teamId === otherId,
    })
  }
  return list.sort((a, b) => a.matchday - b.matchday || a.matchId - b.matchId)
}

function findMatchById(remaining: Match[], matchId: number): Match | null {
  return remaining.find((m) => m.matchID === matchId) ?? null
}

function HardnessBadge({
  hardness,
  leagueSize,
}: {
  hardness: ScheduleHardness | undefined
  leagueSize: number
}) {
  if (!hardness || hardness.remainingGames === 0) {
    return <span className="compare-hardness muted">–</span>
  }
  if (!hardness.reliable) {
    return (
      <span className="compare-hardness muted" title="Zu wenige Spiele für stabile Härte">
        keine Aussage
      </span>
    )
  }
  const grade = hardnessGrade(hardness.index)
  return (
    <span className={`compare-hardness tone-${grade}`}>
      {hardnessGradeLabel(grade)}
      <span className="compare-hardness-meta">
        {' '}
        · {Math.round(hardness.index)} · {hardness.rank}/{leagueSize}
      </span>
    </span>
  )
}

function TeamColumn({
  row,
  fixtures,
  fixtureLeans,
  hardness,
  leagueSize,
  nextPrediction,
  nextTitle,
  nextHomeName,
  nextAwayName,
  onExplain,
}: {
  row: StandingRow
  fixtures: RemainingFixture[]
  fixtureLeans: Map<number, MatchLean>
  hardness: ScheduleHardness | undefined
  leagueSize: number
  nextPrediction: ReturnType<typeof predictFixture>
  nextTitle: string
  nextHomeName?: string
  nextAwayName?: string
  onExplain?: (topic: ExplainTopic) => void
}) {
  return (
    <div className="compare-col">
      <div className="compare-team-head">
        {row.teamIconUrl ? (
          <img src={row.teamIconUrl} alt="" width={32} height={32} />
        ) : (
          <span className="crest-fallback" aria-hidden />
        )}
        <div>
          <strong>{row.teamName}</strong>
          <p className="meta">{teamLabel(row)}</p>
        </div>
      </div>

      <dl className="compare-stats">
        <div>
          <dt>Rang</dt>
          <dd>{row.rank}.</dd>
        </div>
        <div>
          <dt>Punkte</dt>
          <dd>{row.points}</dd>
        </div>
        <div>
          <dt>Tordiff</dt>
          <dd>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</dd>
        </div>
        <div>
          <dt>Restspiele</dt>
          <dd>{fixtures.length}</dd>
        </div>
      </dl>

      <div className="compare-hardness-row">
        <span className="label">
          Restprogramm-Härte
          {onExplain && (
            <>
              {' '}
              <ExplainLink
                topic="hardness"
                onExplain={onExplain}
                className="explain-inline"
              >
                Erklärung
              </ExplainLink>
            </>
          )}
        </span>
        <HardnessBadge hardness={hardness} leagueSize={leagueSize} />
      </div>

      {nextPrediction && (
        <MatchPredictionCard
          prediction={nextPrediction}
          perspective="neutral"
          title={nextTitle}
          homeName={nextHomeName}
          awayName={nextAwayName}
          onExplain={onExplain}
          compact
        />
      )}

      <h3 className="compare-list-title">
        Restprogramm
        {onExplain && fixtures.length > 0 && (
          <>
            {' '}
            <ExplainLink
              topic="forecast"
              onExplain={onExplain}
              className="explain-inline"
            >
              Modell erklären
            </ExplainLink>
          </>
        )}
      </h3>
      {fixtures.length === 0 ? (
        <p className="hint tight">Keine offenen Spiele.</p>
      ) : (
        <ul className="compare-fixtures">
          {fixtures.map((f) => (
            <li
              key={f.matchId}
              className={f.isHeadToHead ? 'head-to-head' : undefined}
            >
              <span className="md">ST {f.matchday}</span>
              <span className={`venue venue-${f.venue}`}>{f.venue}</span>
              <span className="opp">{f.opponentName}</span>
              <span className="compare-fixture-end">
                {f.isHeadToHead && <span className="h2h-tag">Direkt</span>}
                <MatchLeanChip
                  lean={fixtureLeans.get(f.matchId) ?? null}
                  compact
                  variant="letter"
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TeamCompare({
  standings,
  remaining,
  scenarios = [],
  hardnessByTeam,
  teamAId,
  teamBId,
  onChangeTeamA,
  onChangeTeamB,
  onExplain,
}: Props) {
  const sorted = useMemo(
    () => [...standings].sort((a, b) => a.teamName.localeCompare(b.teamName, 'de')),
    [standings],
  )

  const teamA = standings.find((s) => s.teamId === teamAId) ?? null
  const teamB = standings.find((s) => s.teamId === teamBId) ?? null

  const fixturesA = useMemo(
    () => (teamAId != null ? remainingFixturesFor(teamAId, remaining, teamBId) : []),
    [teamAId, teamBId, remaining],
  )
  const fixturesB = useMemo(
    () => (teamBId != null ? remainingFixturesFor(teamBId, remaining, teamAId) : []),
    [teamAId, teamBId, remaining],
  )

  const h2hMatch = useMemo(() => {
    if (teamAId == null || teamBId == null) return null
    return (
      remaining.find(
        (m) =>
          (m.team1.teamId === teamAId && m.team2.teamId === teamBId) ||
          (m.team1.teamId === teamBId && m.team2.teamId === teamAId),
      ) ?? null
    )
  }, [remaining, teamAId, teamBId])

  const h2hPrediction = useMemo(
    () => (h2hMatch ? predictFixture(standings, h2hMatch, { scenarios }) : null),
    [standings, h2hMatch, scenarios],
  )

  const nextA = fixturesA[0] ?? null
  const nextB = fixturesB[0] ?? null
  // Nächstes Spiel nur zusätzlich, wenn es nicht schon das H2H ist
  const nextPredA = useMemo(() => {
    if (!nextA || nextA.isHeadToHead) return null
    const m = findMatchById(remaining, nextA.matchId)
    return m ? predictFixture(standings, m, { scenarios }) : null
  }, [nextA, remaining, standings, scenarios])
  const nextPredB = useMemo(() => {
    if (!nextB || nextB.isHeadToHead) return null
    const m = findMatchById(remaining, nextB.matchId)
    return m ? predictFixture(standings, m, { scenarios }) : null
  }, [nextB, remaining, standings, scenarios])

  const leansA = useMemo(() => {
    const map = new Map<number, MatchLean>()
    if (teamAId == null) return map
    for (const f of fixturesA) {
      const m = findMatchById(remaining, f.matchId)
      if (!m) continue
      const pred = predictFixture(standings, m, { scenarios })
      if (!pred) continue
      map.set(
        f.matchId,
        deriveMatchLean(pred, f.venue === 'H' ? 'home' : 'away'),
      )
    }
    return map
  }, [teamAId, fixturesA, remaining, standings, scenarios])

  const leansB = useMemo(() => {
    const map = new Map<number, MatchLean>()
    if (teamBId == null) return map
    for (const f of fixturesB) {
      const m = findMatchById(remaining, f.matchId)
      if (!m) continue
      const pred = predictFixture(standings, m, { scenarios })
      if (!pred) continue
      map.set(
        f.matchId,
        deriveMatchLean(pred, f.venue === 'H' ? 'home' : 'away'),
      )
    }
    return map
  }, [teamBId, fixturesB, remaining, standings, scenarios])

  const h2hCount = fixturesA.filter((f) => f.isHeadToHead).length
  const pointsGap =
    teamA && teamB ? Math.abs(teamA.points - teamB.points) : null
  const pointsLeader =
    teamA && teamB
      ? teamA.points === teamB.points
        ? null
        : teamA.points > teamB.points
          ? teamLabel(teamA)
          : teamLabel(teamB)
      : null

  return (
    <div className="panel compare-panel">
      <h2>Vereinsvergleich</h2>
      <p className="hint">
        Zwei Vereine wählen – Tabelle, Restprogramm, Härte und Spielschätzung
        nebeneinander.
      </p>

      <div className="compare-pickers">
        <label>
          Verein A
          <select
            value={teamAId ?? ''}
            onChange={(e) =>
              onChangeTeamA(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">— wählen —</option>
            {sorted.map((s) => (
              <option
                key={s.teamId}
                value={s.teamId}
                disabled={s.teamId === teamBId}
              >
                {s.teamName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Verein B
          <select
            value={teamBId ?? ''}
            onChange={(e) =>
              onChangeTeamB(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">— wählen —</option>
            {sorted.map((s) => (
              <option
                key={s.teamId}
                value={s.teamId}
                disabled={s.teamId === teamAId}
              >
                {s.teamName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {teamA && teamB ? (
        <>
          <div className="compare-gap">
            <div>
              <span className="label">Punkteabstand</span>
              <strong>
                {pointsGap === 0
                  ? 'Gleichstand'
                  : `${pointsGap} Pkt. · ${pointsLeader} führt`}
              </strong>
            </div>
            <div>
              <span className="label">Restspiele</span>
              <strong>
                {fixturesA.length} · {fixturesB.length}
                {h2hCount > 0
                  ? ` · ${h2hCount}× direkt gegeneinander`
                  : ''}
              </strong>
            </div>
          </div>

          {h2hMatch && h2hPrediction && (
            <div className="compare-h2h">
              <MatchPredictionCard
                prediction={h2hPrediction}
                perspective="neutral"
                title={`Direktes Duell · ${
                  h2hMatch.team1.shortName || h2hMatch.team1.teamName
                } – ${
                  h2hMatch.team2.shortName || h2hMatch.team2.teamName
                } · ST ${h2hMatch.group.groupOrderID}`}
                homeName={
                  h2hMatch.team1.shortName || h2hMatch.team1.teamName
                }
                awayName={
                  h2hMatch.team2.shortName || h2hMatch.team2.teamName
                }
                onExplain={onExplain}
              />
            </div>
          )}

          <div className="compare-grid">
            <TeamColumn
              row={teamA}
              fixtures={fixturesA}
              fixtureLeans={leansA}
              hardness={hardnessByTeam.get(teamA.teamId)}
              leagueSize={standings.length}
              nextPrediction={nextPredA}
              nextTitle={
                nextA
                  ? `Nächstes Spiel · ${
                      nextA.venue === 'H'
                        ? teamLabel(teamA)
                        : nextA.opponentName
                    } – ${
                      nextA.venue === 'A'
                        ? teamLabel(teamA)
                        : nextA.opponentName
                    } · ST ${nextA.matchday}`
                  : 'Nächstes Spiel'
              }
              nextHomeName={
                nextA?.venue === 'H'
                  ? teamLabel(teamA)
                  : nextA?.opponentName
              }
              nextAwayName={
                nextA?.venue === 'A'
                  ? teamLabel(teamA)
                  : nextA?.opponentName
              }
              onExplain={onExplain}
            />
            <TeamColumn
              row={teamB}
              fixtures={fixturesB}
              fixtureLeans={leansB}
              hardness={hardnessByTeam.get(teamB.teamId)}
              leagueSize={standings.length}
              nextPrediction={nextPredB}
              nextTitle={
                nextB
                  ? `Nächstes Spiel · ${
                      nextB.venue === 'H'
                        ? teamLabel(teamB)
                        : nextB.opponentName
                    } – ${
                      nextB.venue === 'A'
                        ? teamLabel(teamB)
                        : nextB.opponentName
                    } · ST ${nextB.matchday}`
                  : 'Nächstes Spiel'
              }
              nextHomeName={
                nextB?.venue === 'H'
                  ? teamLabel(teamB)
                  : nextB?.opponentName
              }
              nextAwayName={
                nextB?.venue === 'A'
                  ? teamLabel(teamB)
                  : nextB?.opponentName
              }
              onExplain={onExplain}
            />
          </div>
        </>
      ) : (
        <p className="hint">Beide Vereine auswählen, um den Vergleich zu sehen.</p>
      )}
    </div>
  )
}
