import { describe, expect, it, vi } from 'vitest'

const queries = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const limit = vi.fn(() => ({ maybeSingle }))
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
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
})
