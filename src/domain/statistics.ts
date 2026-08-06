import type { HistoryEntry, PlayerMatchHistoryEntry } from '../lib/repository'

type ResultCounts = { teamOne: number; draw: number; teamTwo: number }

export type GoalDifferencePoint = { id: string; createdAt: string; value: number | null; outcome: HistoryEntry['outcome'] }
export type PlayerMovement = { playerId: string; playerName: string; offset: number }
export type PlayerTrendPoint = { id: string; createdAt: string; value: number }
export type RosterStatistics = { results: ResultCounts; goalDifferences: GoalDifferencePoint[]; risers: PlayerMovement[]; fallers: PlayerMovement[] }
export type PlayerStatistics = { results: { win: number; draw: number; loss: number }; netOffset: number; trend: PlayerTrendPoint[]; recentTrend: 'up' | 'down' | 'flat' | null; recentTrendOffset: number; recentTrendMatches: number }

const chronological = <T extends { id: string; createdAt: string }>(entries: readonly T[]) => [...entries].sort((one, two) => one.createdAt.localeCompare(two.createdAt) || one.id.localeCompare(two.id))

export function rosterStatistics(history: readonly HistoryEntry[]): RosterStatistics {
  const results: ResultCounts = { teamOne: 0, draw: 0, teamTwo: 0 }
  const movement = new Map<string, PlayerMovement>()
  for (const entry of history) {
    if (entry.outcome === 'team_one') results.teamOne += 1
    else if (entry.outcome === 'team_two') results.teamTwo += 1
    else results.draw += 1
    for (const player of entry.playerOffsets) {
      const previous = movement.get(player.playerId)
      movement.set(player.playerId, { playerId: player.playerId, playerName: player.playerName, offset: (previous?.offset ?? 0) + player.offset })
    }
  }
  const movements = [...movement.values()]
  return {
    results,
    goalDifferences: chronological(history).map((entry) => ({ id: entry.id, createdAt: entry.createdAt, value: entry.goalDifference, outcome: entry.outcome })),
    risers: movements.filter((player) => player.offset > 0).sort((one, two) => two.offset - one.offset || one.playerName.localeCompare(two.playerName, 'es-AR')).slice(0, 3),
    fallers: movements.filter((player) => player.offset < 0).sort((one, two) => one.offset - two.offset || one.playerName.localeCompare(two.playerName, 'es-AR')).slice(0, 3),
  }
}

export function playerStatistics(history: readonly PlayerMatchHistoryEntry[]): PlayerStatistics {
  const results = { win: 0, draw: 0, loss: 0 }
  let cumulativeOffset = 0
  const trend = chronological(history).map((entry) => { results[entry.result] += 1; cumulativeOffset += entry.offset; return { id: entry.id, createdAt: entry.createdAt, value: cumulativeOffset } })
  const recent = trend.slice(-5)
  const valueBeforeRecent = trend[trend.length - recent.length - 1]?.value ?? 0
  const recentTrendOffset = recent.length > 1 ? recent.at(-1)!.value - valueBeforeRecent : 0
  return { results, netOffset: cumulativeOffset, trend, recentTrend: recent.length > 1 ? recentTrendOffset > 0 ? 'up' : recentTrendOffset < 0 ? 'down' : 'flat' : null, recentTrendOffset, recentTrendMatches: recent.length }
}
