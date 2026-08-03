import { describe, expect, it } from 'vitest'
import { partitionPlayers, type Player } from './types'

const player = (id: string, archived = false): Player => ({
  id,
  name: id,
  baseRating: 6,
  learnedRating: 6,
  eloSeed: 6,
  icon: '⚽',
  color: '#000',
  ...(archived ? { archived: true } : {}),
})

describe('partitionPlayers', () => {
  it('keeps active and archived players in their loaded order', () => {
    const ana = player('ana')
    const bruno = player('bruno', true)
    const cami = player('cami')

    expect(partitionPlayers([ana, bruno, cami])).toEqual({
      activePlayers: [ana, cami],
      archivedPlayers: [bruno],
    })
  })
})
