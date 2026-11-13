import { describe, expect, it } from 'vitest'
import { latestPlayerOffsets, toChemistryHistory, toHistoryEntries, toHistoryPage, toPlayerMatchHistoryEntries, type HistoryEntry } from './repository'

describe('toHistoryEntries', () => {
  it('keeps a completed match when Supabase embeds its one-to-one result as an object', () => {
    expect(toHistoryEntries([{
      id: 'match-1',
      created_at: '2026-07-31T12:00:00.000Z',
      match_results: { outcome: 'team_one', goal_difference: 2 },
      match_participants: [],
    }])).toEqual([{
      id: 'match-1',
      createdAt: '2026-07-31T12:00:00.000Z',
      outcome: 'team_one',
      goalDifference: 2,
      playerOffsets: [],
    }])
  })

  it('keeps each player Elo offset from the match history', () => {
    expect(toHistoryEntries([{
      id: 'match-2',
      created_at: '2026-07-31T13:00:00.000Z',
      match_results: { outcome: 'team_two', goal_difference: null },
      match_participants: [{ rating_offset: '-0.18', performance_rating: 1, players: { id: 'nico', name: 'Nico' } }],
    }] as unknown as Parameters<typeof toHistoryEntries>[0])).toEqual([{
      id: 'match-2',
      createdAt: '2026-07-31T13:00:00.000Z',
      outcome: 'team_two',
      goalDifference: null,
      playerOffsets: [{ playerId: 'nico', playerName: 'Nico', offset: -0.18, performanceRating: 1 }],
    }])
  })

  it('uses each player’s most recent match offset', () => {
    const history: HistoryEntry[] = [
      { id: 'new', createdAt: '2026-07-31T13:00:00.000Z', outcome: 'team_one', goalDifference: null, playerOffsets: [{ playerId: 'nico', playerName: 'Nico', offset: 0.18, performanceRating: 0 }] },
      { id: 'old', createdAt: '2026-07-30T13:00:00.000Z', outcome: 'team_two', goalDifference: null, playerOffsets: [{ playerId: 'nico', playerName: 'Nico', offset: -0.12, performanceRating: 0 }, { playerId: 'juan', playerName: 'Juan', offset: -0.12, performanceRating: 0 }] },
    ]

    expect(latestPlayerOffsets(history)).toEqual(new Map([['nico', 0.18], ['juan', -0.12]]))
  })
})

describe('toHistoryPage', () => {
  it('keeps one extra row only as a pagination signal', () => {
    const rows: Parameters<typeof toHistoryPage>[0] = [
      { id: 'new', created_at: '2026-08-03T12:00:00.000Z', match_results: { outcome: 'team_one', goal_difference: null }, match_participants: [] },
      { id: 'old', created_at: '2026-08-02T12:00:00.000Z', match_results: { outcome: 'draw', goal_difference: null }, match_participants: [] },
    ]

    expect(toHistoryPage(rows, 1)).toEqual({
      entries: [{ id: 'new', createdAt: '2026-08-03T12:00:00.000Z', outcome: 'team_one', goalDifference: null, playerOffsets: [] }],
      hasMore: true,
    })
  })
})

describe('toChemistryHistory', () => {
  it('keeps the two sides of a completed match without relying on player names', () => {
    expect(toChemistryHistory([{
      match_results: { outcome: 'team_two' },
      match_participants: [{ player_id: 'ana', team: 1 }, { player_id: 'bea', team: 1 }, { player_id: 'cami', team: 2 }],
    }])).toEqual([{
      outcome: 'team_two',
      teams: [['ana', 'bea'], ['cami']],
    }])
  })
})

describe('toPlayerMatchHistoryEntries', () => {
  it('maps the result from the participant team and sorts newest first', () => {
    expect(toPlayerMatchHistoryEntries([{
      match_id: 'old', team: 2, rating_offset: '-0.12', performance_rating: 2,
      matches: { created_at: '2026-07-30T13:00:00.000Z', match_results: { outcome: 'team_one', goal_difference: 1 } },
    }, {
      match_id: 'new', team: 1, rating_offset: '0.18', performance_rating: 1,
      matches: { created_at: '2026-07-31T13:00:00.000Z', match_results: { outcome: 'team_one', goal_difference: 2 } },
    }] as Parameters<typeof toPlayerMatchHistoryEntries>[0])).toEqual([
      { id: 'new', createdAt: '2026-07-31T13:00:00.000Z', result: 'win', goalDifference: 2, offset: 0.18, performanceRating: 1 },
      { id: 'old', createdAt: '2026-07-30T13:00:00.000Z', result: 'loss', goalDifference: 1, offset: -0.12, performanceRating: 2 },
    ])
  })
})
