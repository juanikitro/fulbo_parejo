import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './authCallback'

describe('authErrorMessage', () => {
  it('reads an OAuth failure returned in the callback URL', () => {
    expect(authErrorMessage('?error=access_denied&error_description=El%20acceso%20fue%20cancelado')).toBe('El acceso fue cancelado')
  })
})
