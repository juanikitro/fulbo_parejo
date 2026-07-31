import { describe, expect, it } from 'vitest'
import { createMatchProposal, findComparableSwap } from './matchmaking'
import type { Player } from './types'

const makePlayer = (id: string, rating: number, position?: Player['preferredPosition']): Player => ({
  id,
  name: id,
  baseRating: rating,
  learnedRating: rating,
  eloSeed: rating,
  preferredPosition: position,
  icon: '⚽',
  color: '#000',
})

describe('createMatchProposal', () => {
  it('creates equal teams and separates two goalkeepers', () => {
    const proposal = createMatchProposal([
      makePlayer('gk-1', 7, 'goalkeeper'), makePlayer('gk-2', 6, 'goalkeeper'),
      makePlayer('a', 9), makePlayer('b', 8), makePlayer('c', 7), makePlayer('d', 6),
    ])
    expect(proposal.teamOne.players).toHaveLength(3)
    expect(proposal.teamTwo.players).toHaveLength(3)
    expect(proposal.teamOne.players.some((player) => player.preferredPosition === 'goalkeeper')).toBe(true)
    expect(proposal.teamTwo.players.some((player) => player.preferredPosition === 'goalkeeper')).toBe(true)
  })

  it('leaves one player unassigned for an odd call-up', () => {
    const proposal = createMatchProposal([1, 2, 3, 4, 5].map((rating) => makePlayer(String(rating), rating)))
    expect(proposal.unassigned).toBeDefined()
    expect(proposal.teamOne.players).toHaveLength(2)
    expect(proposal.teamTwo.players).toHaveLength(2)
  })

  it('swaps a player only with a similarly rated player in a compatible position', () => {
    const selected = makePlayer('forward-7', 7, 'forward')
    const candidate = findComparableSwap(selected, [
      makePlayer('goalkeeper-7', 7, 'goalkeeper'),
      makePlayer('forward-9', 9, 'forward'),
      makePlayer('forward-7.2', 7.2, 'forward'),
    ])
    expect(candidate?.id).toBe('forward-7.2')
  })

  it('does not force a swap when the closest compatible player is too far in rating', () => {
    expect(findComparableSwap(makePlayer('forward-7', 7, 'forward'), [makePlayer('forward-9', 9, 'forward')])).toBeUndefined()
  })
})
