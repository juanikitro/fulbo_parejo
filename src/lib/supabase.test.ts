import { describe, expect, it } from 'vitest'
import { authRedirectUrl } from './supabase'

describe('authRedirectUrl', () => {
  it('uses the configured canonical URL instead of a deployment alias', () => {
    expect(authRedirectUrl('https://fulboparejo.vercel.app', 'https://fulboparejo-abc.vercel.app')).toBe('https://fulboparejo.vercel.app')
  })

  it('preserves an invitation token through the Google authentication redirect', () => {
    expect(authRedirectUrl('https://fulboparejo.vercel.app', 'https://fulboparejo-abc.vercel.app/?invite=token-de-prueba')).toBe('https://fulboparejo.vercel.app/?invite=token-de-prueba')
  })
})
