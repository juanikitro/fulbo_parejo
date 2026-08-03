import { useEffect, useState } from 'react'
import { deferInstallPrompt, installInstructions, isInstallPromptDeferred, isInstalledApp, promptForInstall, subscribeToInstallAvailability } from '../lib/pwaInstall'

function storage() {
  try { return window.localStorage } catch { return null }
}
export default function InstallPrompt({ authenticated }: { authenticated: boolean }) {
  const [visible, setVisible] = useState(false)
  const [nativePromptAvailable, setNativePromptAvailable] = useState(false)

  useEffect(() => subscribeToInstallAvailability(setNativePromptAvailable), [])

  useEffect(() => {
    if (!authenticated || isInstalledApp() || isInstallPromptDeferred(storage())) {
      setVisible(false)
      return
    }
    setVisible(true)
  }, [authenticated])

  useEffect(() => {
    if (!visible) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  })

  const dismiss = () => {
    deferInstallPrompt(storage())
    setVisible(false)
  }

  const install = async () => {
    const outcome = await promptForInstall()
    if (outcome !== 'unavailable') dismiss()
  }

  if (!visible) return null
  const instructions = installInstructions(navigator.userAgent, navigator.maxTouchPoints)

  return <div className="modal-backdrop install-prompt-backdrop" onMouseDown={dismiss}>
    <section className="result-modal install-prompt" role="dialog" aria-modal="true" aria-labelledby="install-prompt-title" aria-describedby="install-prompt-description" onMouseDown={(event) => event.stopPropagation()}>
      <span className="install-prompt-icon" aria-hidden="true">⚽</span>
      <p className="eyebrow">FULBO PAREJO</p>
      <h2 id="install-prompt-title">Llevalo a tu inicio</h2>
      <p id="install-prompt-description">Abrí Fulbo Parejo como una app, sin buscarlo cada vez en el navegador.</p>
      {nativePromptAvailable
        ? <p className="install-prompt-hint">Te va a aparecer la confirmación del navegador.</p>
        : <p className="install-prompt-hint">{instructions}</p>}
      <div className="modal-actions">
        <button type="button" className="cancel-button" onClick={dismiss}>{nativePromptAvailable ? 'Ahora no' : 'Entendido'}</button>
        {nativePromptAvailable && <button type="button" className="save-player" autoFocus onClick={() => void install()}>Instalar</button>}
      </div>
    </section>
  </div>
}
