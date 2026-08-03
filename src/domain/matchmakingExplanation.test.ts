import { describe, expect, it } from 'vitest'
import { chemistryFromHistory, chemistryWithSufficientEvidence } from './chemistry'
import { createMatchProposal } from './matchmaking'
import { describeMatchProposal } from './matchmakingExplanation'
import type { Player } from './types'

const makePlayer = (id: string, rating = 7, position?: Player['preferredPosition']): Player => ({
  id,
  name: id,
  baseRating: rating,
  learnedRating: rating,
  eloSeed: rating,
  preferredPosition: position,
  icon: '⚽',
  color: '#000',
})

describe('describeMatchProposal', () => {
  it('explains when two goalkeepers were split between even teams', () => {
    const proposal = createMatchProposal([
      makePlayer('gk-one', 7, 'PO'), makePlayer('gk-two', 7, 'PO'),
      makePlayer('a'), makePlayer('b'), makePlayer('c'), makePlayer('d'),
    ])

    expect(describeMatchProposal(proposal).summary).toContain('un arquero por lado')
  })

  it('explains when there is only one goalkeeper', () => {
    const proposal = createMatchProposal([
      makePlayer('gk', 7, 'PO'), makePlayer('a'), makePlayer('b'), makePlayer('c'),
    ])

    expect(describeMatchProposal(proposal).summary).toContain('hay un solo arquero')
  })

  it('hides the positions summary when nobody registered one', () => {
    const proposal = createMatchProposal([makePlayer('a'), makePlayer('b'), makePlayer('c'), makePlayer('d')])
    const explanation = describeMatchProposal(proposal)

    expect(explanation.summary).not.toContain('líneas')
    expect(explanation.summary).not.toContain('posiciones contempladas')
  })

  it('identifies the unassigned player for an odd call-up', () => {
    const proposal = createMatchProposal(['a', 'b', 'c', 'd', 'e'].map((id) => makePlayer(id)))
    const explanation = describeMatchProposal(proposal)

    expect(proposal.unassigned).toBeDefined()
    expect(explanation.summary).toContain(`${proposal.unassigned!.name} sin asignar`)
    expect(explanation.criteria.some((criterion) => criterion.includes(proposal.unassigned!.name))).toBe(true)
  })

  it('hides chemistry when its history has not reached four shared matches', () => {
    const history = [{ outcome: 'team_one' as const, teams: [['ana', 'bea'], ['cami', 'dani']] as const }]
    const proposal = createMatchProposal(
      ['ana', 'bea', 'cami', 'dani'].map((id) => makePlayer(id)),
      chemistryFromHistory(history),
      chemistryWithSufficientEvidence(history),
    )

    expect(proposal.chemistryChangedResult).toBe(false)
    expect(describeMatchProposal(proposal).summary).not.toContain('química considerada')
  })
})
