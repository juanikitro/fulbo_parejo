import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RosterAccessDialog from './RosterAccessDialog'

const renderDialog = (entries: Parameters<typeof RosterAccessDialog>[0]['entries'], actorRole: 'owner' | 'technical' = 'owner', options: { loading?: boolean; loadError?: string | null; inviteError?: string | null; inviting?: boolean } = {}) => renderToStaticMarkup(<RosterAccessDialog actorRole={actorRole} entries={entries} loading={options.loading ?? false} loadError={options.loadError ?? null} inviteError={options.inviteError ?? null} inviting={options.inviting ?? false} actionUserId={null} onClose={() => undefined} onInvite={() => undefined} onChangeRole={() => undefined} onRemove={() => undefined} onTransfer={() => undefined} />)

describe('RosterAccessDialog', () => {
  it('renders the owner and a clear empty state when nobody else has access', () => {
    const markup = renderDialog([{ userId: 'juani', displayName: 'Juani', role: 'owner' }])

    expect(markup).toContain('Juani')
    expect(markup).toContain('Propietario')
    expect(markup).toContain('Todavía no hay personas con acceso al plantel.')
    expect(markup).toContain('Invitar jugador por WhatsApp')
    expect(markup).toContain('Invitar cuerpo técnico')
  })

  it('renders existing members and a generation error without hiding the retry CTA', () => {
    const markup = renderDialog([{ userId: 'juani', displayName: 'Juani', role: 'owner' }, { userId: 'mica', displayName: 'Mica', role: 'technical' }], 'owner', { inviteError: 'No se pudo crear la invitación.' })

    expect(markup).toContain('Mica')
    expect(markup).toContain('Cuerpo técnico')
    expect(markup).toContain('No se pudo crear la invitación.')
    expect(markup).toContain('Transferir')
    expect(markup).toContain('Quitar')
    expect(markup).toContain('Invitar jugador por WhatsApp')
    expect(markup).not.toContain('disabled=""')
  })

  it('lets technical staff invite players but not change existing access', () => {
    const markup = renderDialog([{ userId: 'juani', displayName: 'Juani', role: 'owner' }, { userId: 'mica', displayName: 'Mica', role: 'technical' }], 'technical')

    expect(markup).toContain('Invitar jugador por WhatsApp')
    expect(markup).not.toContain('Invitar cuerpo técnico')
    expect(markup).not.toContain('Transferir')
    expect(markup).not.toContain('Quitar')
  })
})
