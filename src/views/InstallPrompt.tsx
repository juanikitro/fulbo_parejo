import { useEffect, useState } from 'react'
import { canShowInstallReminder, deferInstallPrompt, installInstructions, isAppleMobile, isInstallPromptDeferred, isInstalledApp, promptForInstall, subscribeToInstallAvailability } from '../lib/pwaInstall'

function storage() {
  try { return window.localStorage } catch { return null }
}
export function InstallAppButton({ onOpen }: { onOpen: () => void }) {
  const [installed, setInstalled] = useState(() => isInstalledApp())

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const sync = () => setInstalled(isInstalledApp())
    media.addEventListener('change', sync)
    window.addEventListener('appinstalled', sync)
    return () => { media.removeEventListener('change', sync); window.removeEventListener('appinstalled', sync) }
  }, [])

  if (installed) return null
  return <button type="button" className="header-icon-button install-app-button" aria-label="Instalar Fulbo Parejo como app" title="Instalar app" onClick={onOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" /></svg></button>
}

type InstallPromptProps = {
  authenticated: boolean
  afterMilestone: boolean
  open: boolean
  onOpen: () => void
  onClose: () => void
}

export default function InstallPrompt({ authenticated, afterMilestone, open, onOpen, onClose }: InstallPromptProps) {
  const [nativePromptAvailable, setNativePromptAvailable] = useState(false)

  useEffect(() => subscribeToInstallAvailability(setNativePromptAvailable), [])

  useEffect(() => {
    if (canShowInstallReminder({ afterMilestone, authenticated, installed: isInstalledApp(), deferred: isInstallPromptDeferred(storage()) })) onOpen()
  }, [afterMilestone, authenticated, onOpen])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const dismiss = () => {
    deferInstallPrompt(storage())
    onClose()
  }

  const install = async () => {
    const outcome = await promptForInstall()
    if (outcome !== 'unavailable') dismiss()
  }

  if (!open) return null
  const instructions = installInstructions(navigator.userAgent, navigator.maxTouchPoints)
  const appleMobile = isAppleMobile(navigator.userAgent, navigator.maxTouchPoints)

  return <div className="modal-backdrop install-prompt-backdrop" onMouseDown={dismiss}>
    <section className="result-modal install-prompt" role="dialog" aria-modal="true" aria-labelledby="install-prompt-title" aria-describedby="install-prompt-description" onMouseDown={(event) => event.stopPropagation()}>
      <span className="install-prompt-icon" aria-hidden="true">⚽</span>
      <p className="eyebrow">FULBO PAREJO</p>
      <h2 id="install-prompt-title">Llevalo a tu inicio</h2>
      <p id="install-prompt-description">Abrí Fulbo Parejo como una app, sin buscarlo cada vez en el navegador.</p>
      {appleMobile
        ? <ol className="install-prompt-steps"><li><span aria-hidden="true">↑</span><p>En <strong>Safari</strong>, tocá <strong>Compartir</strong>.</p></li><li><span aria-hidden="true">＋</span><p>Elegí <strong>Agregar a pantalla de inicio</strong> y confirmá.</p></li></ol>
        : nativePromptAvailable
        ? <p className="install-prompt-hint">Te va a aparecer la confirmación del navegador.</p>
        : <p className="install-prompt-hint">{instructions}</p>}
      <div className="modal-actions">
        <button type="button" className="cancel-button" onClick={dismiss}>{nativePromptAvailable ? 'Ahora no' : 'Entendido'}</button>
        {nativePromptAvailable && <button type="button" className="save-player" autoFocus onClick={() => void install()}>Instalar</button>}
      </div>
    </section>
  </div>
}
