import { describe, expect, it } from 'vitest'
import { groupCallupPlayers } from './callup'
import type { Player, Position } from './types'

const player = (id: string, preferredPosition?: Position): Player => ({
  id,
  name: id,
  baseRating: 6,
  learnedRating: 6,
  eloSeed: 6,
  preferredPosition,
  icon: '⚽',
  color: '#000000',
})

describe('groupCallupPlayers', () => {
  it('orders position lines and leaves players without a position last', () => {
    const groups = groupCallupPlayers([
      player('sin-posicion'),
      player('delantero', 'DC'),
      player('defensor', 'DFC'),
      player('arquero', 'PO'),
      player('mediocampista', 'MC'),
    ])

    expect(groups.map(({ label, players }) => [label, players.map((entry) => entry.id)])).toEqual([
      ['Porteros', ['arquero']],
      ['Defensores', ['defensor']],
      ['Mediocampistas', ['mediocampista']],
      ['Delanteros', ['delantero']],
      ['Sin posición', ['sin-posicion']],
    ])
  })
})
