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
      makePlayer('gk-1', 7, 'PO'), makePlayer('gk-2', 6, 'PO'),
      makePlayer('a', 9), makePlayer('b', 8), makePlayer('c', 7), makePlayer('d', 6),
    ])
    expect(proposal.teamOne.players).toHaveLength(3)
    expect(proposal.teamTwo.players).toHaveLength(3)
    expect(proposal.teamOne.players.some((player) => player.preferredPosition === 'PO')).toBe(true)
    expect(proposal.teamTwo.players.some((player) => player.preferredPosition === 'PO')).toBe(true)
  })

  it('leaves one player unassigned for an odd call-up', () => {
    const proposal = createMatchProposal([1, 2, 3, 4, 5].map((rating) => makePlayer(String(rating), rating)))
    expect(proposal.unassigned).toBeDefined()
    expect(proposal.teamOne.players).toHaveLength(2)
    expect(proposal.teamTwo.players).toHaveLength(2)
  })

  it('swaps a player only with a similarly rated player in a compatible position', () => {
    const selected = makePlayer('forward-7', 7, 'DC')
    const candidate = findComparableSwap(selected, [
      makePlayer('goalkeeper-7', 7, 'PO'),
      makePlayer('forward-9', 9, 'DC'),
      makePlayer('forward-7.2', 7.2, 'DC'),
    ])
    expect(candidate?.id).toBe('forward-7.2')
  })

  it('does not force a swap when the closest compatible player is too far in rating', () => {
    expect(findComparableSwap(makePlayer('forward-7', 7, 'DC'), [makePlayer('forward-9', 9, 'DC')])).toBeUndefined()
  })

  it('balances each exact position when compatible players are available', () => {
    const proposal = createMatchProposal(['PO', 'DFI', 'DFC', 'MC', 'DC'].flatMap((position) => [
      makePlayer(`${position}-1`, 7, position as Player['preferredPosition']),
      makePlayer(`${position}-2`, 7, position as Player['preferredPosition']),
    ]))

    expect(proposal.positionPenalty).toBe(0)
    for (const position of ['PO', 'DFI', 'DFC', 'MC', 'DC']) {
      expect(proposal.teamOne.players.filter((player) => player.preferredPosition === position)).toHaveLength(1)
      expect(proposal.teamTwo.players.filter((player) => player.preferredPosition === position)).toHaveLength(1)
    }
  })

  it('prefers a swap in the same line when the exact position is unavailable', () => {
    const selected = makePlayer('centre-back', 7, 'DFC')
    const candidate = findComparableSwap(selected, [
      makePlayer('left-back', 7.2, 'DFI'),
      makePlayer('midfielder', 7.1, 'MC'),
    ])

    expect(candidate?.id).toBe('left-back')
  })
})
