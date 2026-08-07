import { afterEach, describe, expect, it, vi } from 'vitest'
import { authRedirectUrl } from './supabase'

describe('authRedirectUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the configured canonical URL instead of a deployment alias', () => {
    expect(authRedirectUrl('https://fulboparejo.vercel.app', 'https://fulboparejo-abc.vercel.app')).toBe('https://fulboparejo.vercel.app')
  })

  it('preserves an invitation token through the Google authentication redirect', () => {
    expect(authRedirectUrl('https://fulboparejo.vercel.app', 'https://fulboparejo-abc.vercel.app/?invite=token-de-prueba')).toBe('https://fulboparejo.vercel.app/?invite=token-de-prueba')
  })

  it('preserves the invitation token from the current browser URL by default', () => {
    vi.stubGlobal('window', {
      location: {
        href: 'https://fulboparejo.vercel.app/?invite=token-de-prueba',
        origin: 'https://fulboparejo.vercel.app',
      },
    })

    expect(authRedirectUrl('https://fulboparejo.vercel.app')).toBe('https://fulboparejo.vercel.app/?invite=token-de-prueba')
  })
})
