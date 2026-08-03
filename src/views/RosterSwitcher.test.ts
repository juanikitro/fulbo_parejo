import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RosterSwitcher, { RosterNameDialog } from './RosterSwitcher'

describe('RosterSwitcher', () => {
  it('names the active roster in the trigger', () => {
    const markup = renderToStaticMarkup(createElement(RosterSwitcher, { currentId: 'monday', rosters: [{ id: 'monday', name: 'Fútbol de los lunes', ownerId: 'me' }], userId: 'me', saving: false, onSelect: () => undefined, onCreate: async () => undefined, onRename: async () => undefined }))
    expect(markup).toContain('Fútbol de los lunes')
  })

  it('renders the first-roster naming prompt', () => {
    const markup = renderToStaticMarkup(createElement(RosterNameDialog, { title: 'Crear plantel', saving: false, onSave: async () => undefined }))
    expect(markup).toContain('Crear plantel')
    expect(markup).toContain('Fútbol de los lunes')
  })
})
