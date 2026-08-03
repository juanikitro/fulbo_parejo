export type InstallPromptOutcome = 'accepted' | 'dismissed' | 'unavailable'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
type InstallAvailabilityListener = (available: boolean) => void

export const installPromptStorageKey = 'fulbo-parejo-install-prompt-deferred-until-v2'
export const installPromptDeferralMs = 30 * 24 * 60 * 60 * 1000

let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false
const availabilityListeners = new Set<InstallAvailabilityListener>()

function notifyInstallAvailability() {
  availabilityListeners.forEach((listener) => listener(deferredPrompt !== null))
}

function initializeInstallPrompt() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notifyInstallAvailability()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyInstallAvailability()
  })
}

initializeInstallPrompt()

export function subscribeToInstallAvailability(listener: InstallAvailabilityListener) {
  initializeInstallPrompt()
  availabilityListeners.add(listener)
  listener(deferredPrompt !== null)
  return () => { availabilityListeners.delete(listener) }
}

export function isInstalledApp() {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

export function isInstallPromptDeferred(storage: Storage | null, now = Date.now()) {
  if (!storage) return false
  try {
    const deferredUntil = Number(storage.getItem(installPromptStorageKey))
    return Number.isFinite(deferredUntil) && deferredUntil > now
  } catch {
    return false
  }
}

export function canShowInstallPrompt({ authenticated, installed, deferred }: { authenticated: boolean; installed: boolean; deferred: boolean }) {
  return authenticated && !installed && !deferred
}

export function deferInstallPrompt(storage: Storage | null, now = Date.now()) {
  if (!storage) return
  try {
    storage.setItem(installPromptStorageKey, String(now + installPromptDeferralMs))
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function installInstructions(userAgent: string, maxTouchPoints = 0) {
  const isAppleMobile = /iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  if (isAppleMobile) return 'Abrí Fulbo Parejo en Safari, tocá Compartir y elegí “Agregar a pantalla de inicio”.'
  if (/Android/i.test(userAgent)) return 'Abrí el menú ⋮ del navegador y elegí “Instalar app” o “Agregar a pantalla principal”.'
  return 'Abrí el menú del navegador y elegí “Instalar Fulbo Parejo” o “Instalar esta aplicación”.'
}

export async function promptForInstall(): Promise<InstallPromptOutcome> {
  const prompt = deferredPrompt
  if (!prompt) return 'unavailable'
  deferredPrompt = null
  notifyInstallAvailability()
  try {
    await prompt.prompt()
    return (await prompt.userChoice).outcome
  } catch {
    return 'unavailable'
  }
}
