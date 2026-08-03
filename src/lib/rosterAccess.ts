export type RosterAccessEntry = {
  displayName: string
  role: 'owner' | 'member'
}

export const canManageRosterAccess = (isOwner: boolean) => isOwner

export function buildRosterInvitationUrl(origin: string, pathname: string, token: string) {
  const url = new URL(pathname, origin)
  url.searchParams.set('invite', token)
  return url.toString()
}

export function buildWhatsAppInvitationText(invitationUrl: string) {
  return `Te invito a sumarte al plantel de Fulbo Parejo. Abrí este link, iniciá sesión con Google y vas a tener acceso: ${invitationUrl}`
}

export function buildWhatsAppInvitationUrl(invitationUrl: string) {
  const url = new URL('https://wa.me/')
  url.searchParams.set('text', buildWhatsAppInvitationText(invitationUrl))
  return url.toString()
}

export async function generateWhatsAppInvitation(
  createInvitation: () => Promise<{ token: string }>,
  origin: string,
  pathname: string,
  openWhatsApp: (url: string) => void,
) {
  const invitation = await createInvitation()
  const invitationUrl = buildRosterInvitationUrl(origin, pathname, invitation.token)
  const whatsAppUrl = buildWhatsAppInvitationUrl(invitationUrl)
  openWhatsApp(whatsAppUrl)
  return whatsAppUrl
}

export async function runOnce<T>(inFlight: { current: boolean }, operation: () => Promise<T>) {
  if (inFlight.current) return undefined
  inFlight.current = true
  try {
    return await operation()
  } finally {
    inFlight.current = false
  }
}
