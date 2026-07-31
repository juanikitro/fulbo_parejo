import { describe, expect, it } from 'vitest'
import { latestPlayerOffsets, toHistoryEntries, type HistoryEntry } from './repository'

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
      match_participants: [{ rating_offset: '-0.18', players: { id: 'nico', name: 'Nico' } }],
    }] as unknown as Parameters<typeof toHistoryEntries>[0])).toEqual([{
      id: 'match-2',
      createdAt: '2026-07-31T13:00:00.000Z',
      outcome: 'team_two',
      goalDifference: null,
      playerOffsets: [{ playerId: 'nico', playerName: 'Nico', offset: -0.18 }],
    }])
  })

  it('uses each player’s most recent match offset', () => {
    const history: HistoryEntry[] = [
      { id: 'new', createdAt: '2026-07-31T13:00:00.000Z', outcome: 'team_one', goalDifference: null, playerOffsets: [{ playerId: 'nico', playerName: 'Nico', offset: 0.18 }] },
      { id: 'old', createdAt: '2026-07-30T13:00:00.000Z', outcome: 'team_two', goalDifference: null, playerOffsets: [{ playerId: 'nico', playerName: 'Nico', offset: -0.12 }, { playerId: 'juan', playerName: 'Juan', offset: -0.12 }] },
    ]

    expect(latestPlayerOffsets(history)).toEqual(new Map([['nico', 0.18], ['juan', -0.12]]))
  })
})
