import { describe, expect, it } from 'vitest'
import { chemistryFromHistory, chemistryPairsFromHistory, pairChemistry } from './chemistry'

describe('chemistryFromHistory', () => {
  it('rewards wins, gives draws a smaller reward, and penalizes losses for pairs on the same team', () => {
    const chemistry = chemistryFromHistory([
      { outcome: 'team_one', teams: [['ana', 'bea'], ['cami', 'dani']] },
      { outcome: 'draw', teams: [['ana', 'bea'], ['cami', 'dani']] },
      { outcome: 'team_two', teams: [['ana', 'bea'], ['cami', 'dani']] },
      { outcome: 'team_one', teams: [['ana', 'bea'], ['cami', 'dani']] },
    ])

    expect(pairChemistry(chemistry, 'ana', 'bea')).toBe(0.3125)
    expect(pairChemistry(chemistry, 'cami', 'dani')).toBe(-0.1875)
  })

  it('keeps early chemistry gradual until a pair has enough shared matches', () => {
    const chemistry = chemistryFromHistory([
      { outcome: 'team_one', teams: [['ana', 'bea'], ['cami', 'dani']] },
    ])

    expect(pairChemistry(chemistry, 'ana', 'bea')).toBe(0.25)
  })

  it('ignores players who only faced each other', () => {
    const chemistry = chemistryFromHistory([
      { outcome: 'team_one', teams: [['ana'], ['bea']] },
    ])

    expect(pairChemistry(chemistry, 'ana', 'bea')).toBe(0)
  })

  it('keeps the shared match count alongside each pair score for player details', () => {
    const pairs = chemistryPairsFromHistory([
      { outcome: 'team_one', teams: [['ana', 'bea'], ['cami', 'dani']] },
      { outcome: 'draw', teams: [['ana', 'bea'], ['cami', 'dani']] },
    ])

    expect(pairs).toContainEqual({ playerIds: ['ana', 'bea'], score: 0.3125, matches: 2 })
    expect(pairs).toContainEqual({ playerIds: ['cami', 'dani'], score: -0.1875, matches: 2 })
  })
})
