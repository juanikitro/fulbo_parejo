import { describe, expect, it } from 'vitest'
import { buildRosterInvitationUrl, buildWhatsAppInvitationText, buildWhatsAppInvitationUrl, canInviteRole, canManageRosterAccess, canPlanMatch, generateWhatsAppInvitation, runOnce } from './rosterAccess'

describe('roster access invitations', () => {
  it('enables access management for the owner and technical staff', () => {
    expect(canManageRosterAccess('owner')).toBe(true)
    expect(canManageRosterAccess('technical')).toBe(true)
    expect(canManageRosterAccess('player')).toBe(false)
  })

  it('lets every roster role plan teams without granting roster editing', () => {
    expect(canPlanMatch('owner')).toBe(true)
    expect(canPlanMatch('technical')).toBe(true)
    expect(canPlanMatch('player')).toBe(true)
    expect(canPlanMatch(null)).toBe(false)
  })

  it('limits invitations to the roles each actor can grant', () => {
    expect(canInviteRole('owner', 'technical')).toBe(true)
    expect(canInviteRole('owner', 'player')).toBe(true)
    expect(canInviteRole('technical', 'technical')).toBe(false)
    expect(canInviteRole('technical', 'player')).toBe(true)
    expect(canInviteRole('player', 'player')).toBe(false)
  })

  it('builds the invitation link and WhatsApp text without exposing the token elsewhere', () => {
    const invitationUrl = buildRosterInvitationUrl('https://fulboparejo.vercel.app', '/', 'token-de-prueba')

    expect(invitationUrl).toBe('https://fulboparejo.vercel.app/?invite=token-de-prueba')
    expect(buildWhatsAppInvitationText(invitationUrl)).toBe('Te invito a sumarte al plantel de Fulbo Parejo. El link es válido durante 3 días y puede usarlo más de una persona. Abrí este link, iniciá sesión con Google y vas a tener acceso: https://fulboparejo.vercel.app/?invite=token-de-prueba')
    expect(new URL(buildWhatsAppInvitationUrl(invitationUrl)).searchParams.get('text')).toBe(buildWhatsAppInvitationText(invitationUrl))
  })

  it('runs only one invitation generation while the first click is pending', async () => {
    const inFlight = { current: false }
    let calls = 0
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => { release = resolve })
    const createInvitation = async () => { calls += 1; await pending; return 'created' }

    const first = runOnce(inFlight, createInvitation)
    const second = runOnce(inFlight, createInvitation)
    expect(calls).toBe(1)
    expect(second).resolves.toBeUndefined()

    release!()
    await expect(first).resolves.toBe('created')
    await expect(runOnce(inFlight, createInvitation)).resolves.toBe('created')
    expect(calls).toBe(2)
  })

  it('does not open WhatsApp when invitation generation fails', async () => {
    const openedUrls: string[] = []
    const openWhatsApp = (url: string) => openedUrls.push(url)

    await expect(generateWhatsAppInvitation(async () => { throw new Error('No se pudo crear la invitación.') }, 'https://fulboparejo.vercel.app', '/', openWhatsApp)).rejects.toThrow('No se pudo crear la invitación.')
    expect(openedUrls).toEqual([])
  })
})
