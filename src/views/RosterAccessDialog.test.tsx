import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RosterAccessDialog from './RosterAccessDialog'

const renderDialog = (entries: Parameters<typeof RosterAccessDialog>[0]['entries'], options: { loading?: boolean; loadError?: string | null; inviteError?: string | null; inviting?: boolean } = {}) => renderToStaticMarkup(<RosterAccessDialog entries={entries} loading={options.loading ?? false} loadError={options.loadError ?? null} inviteError={options.inviteError ?? null} inviting={options.inviting ?? false} onClose={() => undefined} onInvite={() => undefined} />)

describe('RosterAccessDialog', () => {
  it('renders the owner and a clear empty state when nobody else has access', () => {
    const markup = renderDialog([{ displayName: 'Juani', role: 'owner' }])

    expect(markup).toContain('Juani')
    expect(markup).toContain('Propietario')
    expect(markup).toContain('Todavía no hay miembros con acceso al plantel.')
    expect(markup).toContain('Invitar por WhatsApp')
  })

  it('renders existing members and a generation error without hiding the retry CTA', () => {
    const markup = renderDialog([{ displayName: 'Juani', role: 'owner' }, { displayName: 'Mica', role: 'member' }], { inviteError: 'No se pudo crear la invitación.' })

    expect(markup).toContain('Mica')
    expect(markup).toContain('Miembro')
    expect(markup).toContain('No se pudo crear la invitación.')
    expect(markup).toContain('Invitar por WhatsApp')
    expect(markup).not.toContain('disabled=""')
  })
})
