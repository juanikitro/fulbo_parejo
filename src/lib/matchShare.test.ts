import { describe, expect, it } from 'vitest'
import { formatMatchShareText } from './matchShare'

describe('formatMatchShareText', () => {
  it('includes both team rosters in the fallback text', () => {
    const summary = formatMatchShareText(
      { name: 'Equipo Claro', players: [{ name: 'Samu' }, { name: 'Moni' }] },
      { name: 'Equipo Oscuro', players: [{ name: 'Bates' }, { name: 'Feli' }] },
    )

    expect(summary).toBe('Equipo Claro\n• Samu\n• Moni\n\nVS\n\nEquipo Oscuro\n• Bates\n• Feli')
  })
})
