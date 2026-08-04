import { describe, expect, it } from 'vitest'
import { canShowInstallReminder, canShowInstallPrompt, deferInstallPrompt, installInstructions, installPromptDeferralMs, isInstallPromptDeferred } from './pwaInstall'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage
}

describe('PWA installation prompt', () => {
  it('allows the persistent installation action for an authenticated session without a deferral', () => {
    expect(canShowInstallPrompt({ authenticated: true, installed: false, deferred: false })).toBe(true)
  })

  it('shows the automatic reminder only after the first useful action', () => {
    expect(canShowInstallReminder({ afterMilestone: false, authenticated: true, installed: false, deferred: false })).toBe(false)
    expect(canShowInstallReminder({ afterMilestone: true, authenticated: true, installed: false, deferred: false })).toBe(true)
  })

  it('defers a dismissed promotion for 30 days', () => {
    const localStorage = storage()
    const now = 1_000
    deferInstallPrompt(localStorage, now)

    expect(isInstallPromptDeferred(localStorage, now + installPromptDeferralMs - 1)).toBe(true)
    expect(isInstallPromptDeferred(localStorage, now + installPromptDeferralMs)).toBe(false)
  })

  it('shows the popup again when only the v1 deferral exists', () => {
    const localStorage = storage()
    localStorage.setItem('fulbo-parejo-install-prompt-deferred-until-v1', String(Date.now() + installPromptDeferralMs))

    expect(isInstallPromptDeferred(localStorage)).toBe(false)
  })

  it('does not show the popup when it already runs as an installed app', () => {
    expect(canShowInstallPrompt({ authenticated: true, installed: true, deferred: false })).toBe(false)
  })

  it('shows iOS instructions when a native prompt is unavailable', () => {
    const instructions = installInstructions('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    expect(instructions).toContain('Safari')
    expect(instructions).toContain('Compartir')
  })
})
