import { describe, expect, it } from 'vitest'
import { applyEloResult, inferRatingScale } from './elo'
import type { Player } from './types'

const player = (id: string, rating: number): Player => ({ id, name: id, baseRating: rating, learnedRating: rating, eloSeed: rating, icon: '⚽', color: '#000' })

describe('applyEloResult', () => {
  it('detects the 1–100 scale and keeps Elo adjustments proportional', () => {
    const tenScale = applyEloResult([player('five', 5)], [player('four', 4)], 'teamOne').get('five')! - 5
    const hundredScale = applyEloResult([player('fifty', 50)], [player('forty', 40)], 'teamOne').get('fifty')! - 50

    expect(inferRatingScale([player('five', 5), player('four', 4)])).toBe(10)
    expect(inferRatingScale([player('fifty', 50), player('forty', 40)])).toBe(100)
    expect(hundredScale).toBeCloseTo(tenScale * 10)

    const expectedLossAgainstFifty = applyEloResult([player('five', 5)], [player('fifty', 50)], 'teamTwo').get('five')! - 5
    expect(expectedLossAgainstFifty).toBeLessThan(-0.01)
  })

  it('allows a learned rating to continue above 100', () => {
    const experienced = { ...player('experienced', 100), learnedRating: 105 }
    const update = applyEloResult([experienced], [player('challenger', 60)], 'teamOne').get('experienced')!

    expect(update).toBeGreaterThan(105)
  })

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
