import { describe, expect, it, vi } from 'vitest'

const queries = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const limit = vi.fn(() => ({ maybeSingle }))
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn((_relation: string) => ({ select }))
  return { maybeSingle, limit, order, from }
})

vi.mock('./supabase', () => ({
  supabase: { from: queries.from },
}))

import { ensureRoster } from './repository'

describe('ensureRoster', () => {
  it('elige determinísticamente el primer plantel propio cuando la cuenta tiene varios', async () => {
    queries.maybeSingle.mockResolvedValueOnce({ data: { id: 'plantel-inicial' }, error: null })

    await expect(ensureRoster({ id: 'cuenta-1' } as never)).resolves.toBe('plantel-inicial')

    expect(queries.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(queries.limit).toHaveBeenCalledWith(1)
  })

  it('abre el plantel compartido de una cuenta sin plantel propio sin intentar crear uno', async () => {
    queries.from.mockClear()
    queries.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockImplementationOnce(async () => {
        const relation = queries.from.mock.lastCall?.[0]
        return relation === 'roster_access'
          ? { data: { roster_id: 'plantel-compartido' }, error: null }
          : { data: null, error: { code: '42501', message: 'permission denied' } }
      })

    await expect(ensureRoster({ id: 'cuenta-colaboradora' } as never)).resolves.toBe('plantel-compartido')

    expect(queries.from.mock.calls).toEqual([['rosters'], ['roster_access']])
  })
})
