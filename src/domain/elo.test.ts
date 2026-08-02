import { describe, expect, it } from 'vitest'
import { applyEloResult } from './elo'
import type { Player } from './types'

const player = (id: string, rating: number): Player => ({ id, name: id, baseRating: rating, learnedRating: rating, eloSeed: rating, icon: '⚽', color: '#000' })

describe('applyEloResult', () => {
  it('rewards an upset more than an expected win', () => {
    const strong = [player('strong', 9)]
    const weak = [player('weak', 5)]
    const upset = applyEloResult(strong, weak, 'teamTwo').get('weak')! - 5
    const expected = applyEloResult(strong, weak, 'teamOne').get('strong')! - 9
    expect(upset).toBeGreaterThan(expected)
  })

  it('does not change ratings on an even draw', () => {
    const one = player('one', 7)
    const two = player('two', 7)
    const updates = applyEloResult([one], [two], 'draw')
    expect(updates.get('one')).toBe(7)
    expect(updates.get('two')).toBe(7)
  })

  it('makes a very good loss and a very bad win count half as much', () => {
    const one = player('one', 7)
    const two = player('two', 7)
    const normal = applyEloResult([one], [two], 'teamOne')
    const adjusted = applyEloResult([one], [two], 'teamOne', undefined, new Map([['one', -2], ['two', 2]]))

    expect(adjusted.get('one')! - 7).toBeCloseTo((normal.get('one')! - 7) / 2)
    expect(7 - adjusted.get('two')!).toBeCloseTo((7 - normal.get('two')!) / 2)
  })
})
