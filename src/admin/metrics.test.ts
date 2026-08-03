import { describe, expect, it } from 'vitest'
import { adminHash, invitationLabel, metric } from './metrics'

describe('admin presentation helpers', () => {
  it('recognizes only the protected admin hash route', () => {
    expect(adminHash('#/admin')).toBe(true)
    expect(adminHash('#/admin/users')).toBe(false)
    expect(adminHash('#invite-token')).toBe(false)
  })

  it('does not turn unavailable values into a made-up metric', () => {
    expect(metric(null)).toBe('—')
    expect(metric(42.25, '%')).toBe('42,3%')
  })

  it('uses a textual label as well as a status style for invitations', () => {
    expect(invitationLabel('expired')).toBe('Vencida')
  })
})

