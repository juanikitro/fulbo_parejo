import { describe, expect, it } from 'vitest'
import { deferInstallPrompt, installInstructions, installPromptDeferralMs, isInstallPromptDeferred } from './pwaInstall'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage
}

describe('PWA installation prompt', () => {
  it('defers a dismissed promotion for 30 days', () => {
    const localStorage = storage()
    const now = 1_000
    deferInstallPrompt(localStorage, now)

    expect(isInstallPromptDeferred(localStorage, now + installPromptDeferralMs - 1)).toBe(true)
    expect(isInstallPromptDeferred(localStorage, now + installPromptDeferralMs)).toBe(false)
  })

  it('shows iOS instructions when a native prompt is unavailable', () => {
    expect(installInstructions('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toContain('Safari')
  })
})
