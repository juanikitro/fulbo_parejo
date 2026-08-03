import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke } } }))

import { adminRequest, isAdmin } from './api'

describe('admin authorization client', () => {
  beforeEach(() => invoke.mockReset())

  it('uses the protected access action instead of a client-side role check', async () => {
    invoke.mockResolvedValue({ data: { isAdmin: true }, error: null })
    await expect(isAdmin()).resolves.toBe(true)
    expect(invoke).toHaveBeenCalledWith('admin-metrics', { body: { action: 'access' } })
  })

  it('keeps the server authorization message from a denied request', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify({ message: 'No tenés permiso para acceder a esta sección.' })) } })
    await expect(adminRequest('summary')).rejects.toThrow('No tenés permiso para acceder a esta sección.')
  })
})

