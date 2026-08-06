import { describe, expect, it } from 'vitest'
import { playerStatistics, rosterStatistics } from './statistics'
import type { HistoryEntry, PlayerMatchHistoryEntry } from '../lib/repository'

const rosterHistory: HistoryEntry[] = [
  { id: 'new', createdAt: '2026-08-02T20:00:00.000Z', outcome: 'team_two', goalDifference: 3, playerOffsets: [{ playerId: 'ana', playerName: 'Ana', offset: -0.2, performanceRating: 0 }, { playerId: 'bea', playerName: 'Bea', offset: 0.3, performanceRating: 0 }] },
  { id: 'old', createdAt: '2026-08-01T20:00:00.000Z', outcome: 'team_one', goalDifference: 1, playerOffsets: [{ playerId: 'ana', playerName: 'Ana', offset: 0.4, performanceRating: 0 }, { playerId: 'cami', playerName: 'Cami', offset: -0.5, performanceRating: 0 }] },
  { id: 'draw', createdAt: '2026-08-03T20:00:00.000Z', outcome: 'draw', goalDifference: null, playerOffsets: [{ playerId: 'ana', playerName: 'Ana', offset: 0, performanceRating: 0 }] },
]

describe('rosterStatistics', () => {
  it('aggregates results, chronological goal differences, and net player movement', () => {
    expect(rosterStatistics(rosterHistory)).toEqual({
      results: { teamOne: 1, draw: 1, teamTwo: 1 },
      goalDifferences: [{ id: 'old', createdAt: '2026-08-01T20:00:00.000Z', value: 1, outcome: 'team_one' }, { id: 'new', createdAt: '2026-08-02T20:00:00.000Z', value: 3, outcome: 'team_two' }, { id: 'draw', createdAt: '2026-08-03T20:00:00.000Z', value: null, outcome: 'draw' }],
      risers: [{ playerId: 'bea', playerName: 'Bea', offset: 0.3 }, { playerId: 'ana', playerName: 'Ana', offset: 0.2 }],
      fallers: [{ playerId: 'cami', playerName: 'Cami', offset: -0.5 }],
    })
  })
})

describe('playerStatistics', () => {
  it('builds a chronological cumulative Elo trend and a recent upward summary', () => {
    const history: PlayerMatchHistoryEntry[] = [
      { id: 'new', createdAt: '2026-08-03T20:00:00.000Z', result: 'win', goalDifference: 2, offset: 0.4, performanceRating: 1 },
      { id: 'old', createdAt: '2026-08-01T20:00:00.000Z', result: 'loss', goalDifference: 1, offset: -0.1, performanceRating: 0 },
      { id: 'middle', createdAt: '2026-08-02T20:00:00.000Z', result: 'draw', goalDifference: null, offset: 0.2, performanceRating: 0 },
    ]
    expect(playerStatistics(history)).toEqual({ results: { win: 1, draw: 1, loss: 1 }, netOffset: 0.5, trend: [{ id: 'old', createdAt: '2026-08-01T20:00:00.000Z', value: -0.1 }, { id: 'middle', createdAt: '2026-08-02T20:00:00.000Z', value: 0.1 }, { id: 'new', createdAt: '2026-08-03T20:00:00.000Z', value: 0.5 }], recentTrend: 'up', recentTrendOffset: 0.5, recentTrendMatches: 3 })
  })
  it('does not infer a trend from a single match', () => {
    expect(playerStatistics([{ id: 'only', createdAt: '2026-08-03T20:00:00.000Z', result: 'draw', goalDifference: null, offset: 0, performanceRating: 0 }])).toMatchObject({ recentTrend: null, recentTrendMatches: 1 })
  })
})
