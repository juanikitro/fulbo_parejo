import { useEffect, useRef } from 'react'
import type { RosterAccessEntry } from '../lib/rosterAccess'

type RosterAccessDialogProps = {
  entries: RosterAccessEntry[]
  loading: boolean
  loadError: string | null
  inviteError: string | null
  inviting: boolean
  onClose: () => void
  onInvite: () => void
}

export default function RosterAccessDialog({ entries, loading, loadError, inviteError, inviting, onClose, onInvite }: RosterAccessDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(onClose)
  const owner = entries.find((entry) => entry.role === 'owner')
  const members = entries.filter((entry) => entry.role === 'member')
  onCloseRef.current = onClose

  useEffect(() => {
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const keepFocusInDialog = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="result-modal roster-access-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="roster-access-title" aria-busy={loading || inviting} onMouseDown={(event) => event.stopPropagation()} onKeyDown={keepFocusInDialog}>
      <div className="form-heading"><div><p className="eyebrow">ACCESO AL PLANTEL</p><h2 id="roster-access-title">Acceso al plantel</h2></div><button ref={closeButtonRef} type="button" aria-label="Cerrar acceso al plantel" disabled={inviting} onClick={onClose}>×</button></div>
      {loading ? <p className="muted" role="status">Cargando personas con acceso…</p> : loadError ? <p className="detail-error" role="alert">{loadError}</p> : <div className="roster-access-content"><section><h3>Propietario</h3>{owner ? <p className="roster-access-person"><strong>{owner.displayName}</strong><small>Propietario</small></p> : <p className="muted">No se pudo identificar a la persona propietaria.</p>}</section><section><h3>Miembros</h3>{members.length ? <ul className="roster-access-list">{members.map((member, index) => <li className="roster-access-person" key={`${member.displayName}-${index}`}><strong>{member.displayName}</strong><small>Miembro</small></li>)}</ul> : <p className="muted">Todavía no hay miembros con acceso al plantel.</p>}</section></div>}
      {inviteError && <p className="detail-error" role="alert">{inviteError}</p>}
      <button type="button" className="save-player roster-invite-button" disabled={loading || inviting} onClick={onInvite}>{inviting ? 'Generando invitación…' : 'Invitar por WhatsApp'}</button>
    </section>
  </div>
}
