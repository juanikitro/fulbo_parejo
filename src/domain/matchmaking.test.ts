import { describe, expect, it } from 'vitest'
import { chemistryFromHistory } from './chemistry'
import { createMatchProposal, findComparableSwap } from './matchmaking'
import type { Player } from './types'

const makePlayer = (id: string, rating: number, position?: Player['preferredPosition'], secondaryPosition?: Player['secondaryPosition']): Player => ({
  id,
  name: id,
  baseRating: rating,
  learnedRating: rating,
  eloSeed: rating,
  preferredPosition: position,
  secondaryPosition,
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

  it('prioritizes the swap that best balances team averages over position', () => {
    const selected = makePlayer('forward-9', 9, 'DC')
    const candidate = findComparableSwap(selected, [selected, makePlayer('teammate-7', 7, 'MC')], [
      makePlayer('forward-5', 5, 'DC'),
      makePlayer('midfielder-8', 8, 'MC'),
    ])

    expect(candidate?.id).toBe('midfielder-8')
  })

  it('uses the same position as a tiebreaker when swaps balance equally', () => {
    const selected = makePlayer('forward-7', 7, 'DC')
    const candidate = findComparableSwap(selected, [selected, makePlayer('teammate-7', 7, 'MC')], [
      makePlayer('defender-7', 7, 'DFC'),
      makePlayer('forward-7', 7, 'DC'),
    ])

    expect(candidate?.id).toBe('forward-7')
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

  it('never swaps a goalkeeper with a field player', () => {
    const selected = makePlayer('centre-back', 7, 'DFC')
    const candidate = findComparableSwap(selected, [selected, makePlayer('teammate-7', 7, 'MC')], [
      makePlayer('goalkeeper-7', 7, 'PO'),
      makePlayer('midfielder-8', 8, 'MC'),
    ])

    expect(candidate?.id).toBe('midfielder-8')
  })

  it('uses a secondary goalkeeper only when a primary goalkeeper is unavailable', () => {
    const proposal = createMatchProposal([
      makePlayer('primary-goalkeeper', 7, 'PO'),
      makePlayer('secondary-goalkeeper', 7, 'DFC', 'PO'),
      makePlayer('a', 7), makePlayer('b', 7), makePlayer('c', 7), makePlayer('d', 7),
    ])

    expect(proposal.teamOne.players.some((player) => player.id === 'primary-goalkeeper')).toBe(true)
    expect(proposal.teamTwo.players.some((player) => player.id === 'secondary-goalkeeper')).toBe(true)
  })

  it('prefers a primary position match over a secondary one for comparable swaps', () => {
    const selected = makePlayer('centre-back', 7, 'DFC', 'MC')
    const candidate = findComparableSwap(selected, [selected, makePlayer('teammate', 7)], [
      makePlayer('secondary-match', 7, 'MC', 'DFC'),
      makePlayer('primary-match', 7, 'DFC'),
    ])

    expect(candidate?.id).toBe('primary-match')
  })

  it('keeps positive pairs together and separates negative pairs when ratings are equal', () => {
    const chemistry = chemistryFromHistory([
      ...Array.from({ length: 4 }, () => ({ outcome: 'team_one' as const, teams: [['ana', 'bea'], ['other-one', 'other-two']] as const })),
      ...Array.from({ length: 4 }, () => ({ outcome: 'team_two' as const, teams: [['other-one', 'other-two'], ['cami', 'dani']] as const })),
      ...Array.from({ length: 4 }, () => ({ outcome: 'team_two' as const, teams: [['ana', 'cami'], ['other-one', 'other-two']] as const })),
      ...Array.from({ length: 4 }, () => ({ outcome: 'team_one' as const, teams: [['other-one', 'other-two'], ['bea', 'dani']] as const })),
    ])

    const proposal = createMatchProposal(['ana', 'bea', 'cami', 'dani'].map((id) => makePlayer(id, 7)), chemistry)
    const teams = [proposal.teamOne.players, proposal.teamTwo.players].map((team) => team.map((player) => player.id))

    expect(teams).toEqual(expect.arrayContaining([
      expect.arrayContaining(['ana', 'bea']),
      expect.arrayContaining(['cami', 'dani']),
    ]))
  })
})
