import { useState } from 'react'
import type { RosterSummary } from '../lib/repository'

type RosterSwitcherProps = {
  currentId: string
  rosters: RosterSummary[]
  userId: string
  saving: boolean
  onSelect: (rosterId: string) => void
  onCreate: (name: string) => Promise<void>
  onRename: (name: string) => Promise<void>
}

export function RosterNameDialog({ title, initialName = '', saving, onClose, onSave }: { title: string; initialName?: string; saving: boolean; onClose?: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = name.trim()
    if (value.length < 2 || value.length > 40) { setError('El nombre debe tener entre 2 y 40 caracteres.'); return }
    setError(null)
    try {
      await onSave(value)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar el plantel.')
    }
  }
  return <div className="modal-backdrop"><form className="result-modal roster-name-dialog" onSubmit={(event) => void submit(event)} aria-labelledby="roster-name-title"><div className="form-heading"><div><p className="eyebrow">PLANTEL</p><h2 id="roster-name-title">{title}</h2></div>{onClose && <button type="button" aria-label="Cerrar" disabled={saving} onClick={onClose}>×</button>}</div><label className="field-label">Nombre del plantel<input autoFocus maxLength={40} placeholder="Ej. Fútbol de los lunes" value={name} onChange={(event) => setName(event.target.value)} /></label>{error && <p className="detail-error" role="alert">{error}</p>}<button className="save-player" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ✓'}</button></form></div>
}

export default function RosterSwitcher({ currentId, rosters, userId, saving, onSelect, onCreate, onRename }: RosterSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'rename' | null>(null)
  const current = rosters.find((roster) => roster.id === currentId)
  const mine = rosters.filter((roster) => roster.ownerId === userId)
  const shared = rosters.filter((roster) => roster.ownerId !== userId)
  const choose = (id: string) => { setOpen(false); onSelect(id) }
  const save = async (name: string) => {
    if (mode === 'create') await onCreate(name)
    else await onRename(name)
    setMode(null); setOpen(false)
  }
  return <><button type="button" className="roster-switcher" aria-label={`Cambiar plantel. Actual: ${current?.name ?? 'Plantel'}`} aria-haspopup="dialog" disabled={saving} onClick={() => setOpen(true)}><span>👥</span><strong>{current?.name ?? 'Plantel'}</strong><span aria-hidden="true">⌄</span></button>{open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><section className="result-modal roster-switcher-dialog" role="dialog" aria-modal="true" aria-labelledby="roster-switcher-title" onMouseDown={(event) => event.stopPropagation()}><div className="form-heading"><div><p className="eyebrow">TUS GRUPOS</p><h2 id="roster-switcher-title">Cambiar plantel</h2></div><button type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button></div><RosterList title="Mis planteles" rosters={mine} currentId={currentId} onSelect={choose} /><RosterList title="Compartidos conmigo" rosters={shared} currentId={currentId} onSelect={choose} /><button type="button" className="roster-new-button" onClick={() => setMode('create')}>+ Crear plantel</button>{current?.ownerId === userId && <button type="button" className="roster-rename-button" onClick={() => setMode('rename')}>✏️ Renombrar “{current.name}”</button>}</section></div>}{mode && <RosterNameDialog title={mode === 'create' ? 'Crear plantel' : 'Renombrar plantel'} initialName={mode === 'rename' ? current?.name : ''} saving={saving} onClose={() => setMode(null)} onSave={save} />}</>
}

function RosterList({ title, rosters, currentId, onSelect }: { title: string; rosters: RosterSummary[]; currentId: string; onSelect: (id: string) => void }) {
  if (!rosters.length) return null
  return <section className="roster-list"><h3>{title}</h3>{rosters.map((roster) => <button type="button" className={roster.id === currentId ? 'active' : ''} key={roster.id} onClick={() => onSelect(roster.id)}><span>{roster.id === currentId ? '✓' : '○'}</span><strong>{roster.name}</strong>{roster.id === currentId && <small>Actual</small>}</button>)}</section>
}
