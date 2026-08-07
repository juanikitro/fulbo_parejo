import { describe, expect, it } from 'vitest'
import { formatMatchShareText, formatShareMovement } from './matchShare'

describe('formatMatchShareText', () => {
  it('includes both team rosters in the fallback text', () => {
    const summary = formatMatchShareText(
      { name: 'Equipo Claro', players: [{ name: 'Samu' }, { name: 'Moni' }] },
      { name: 'Equipo Oscuro', players: [{ name: 'Bates' }, { name: 'Feli' }] },
    )

    expect(summary).toBe('Equipo Claro\n• Samu\n• Moni\n\nVS\n\nEquipo Oscuro\n• Bates\n• Feli')
  })

  it('formats only non-zero latest movements for the shared image', () => {
    expect(formatShareMovement(0.18)).toEqual({ text: '↑ +0.18', color: '#9fdf76' })
    expect(formatShareMovement(-0.12)).toEqual({ text: '↓ -0.12', color: '#ff9c8e' })
    expect(formatShareMovement(0)).toBeNull()
    expect(formatShareMovement(undefined)).toBeNull()
  })
})
