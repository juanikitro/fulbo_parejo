import type { PeriodPreset } from './types'

export const periodOptions: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'today', label: 'Hoy' }, { value: '7d', label: '7 días' }, { value: '30d', label: '30 días' }, { value: '90d', label: '90 días' }, { value: 'all', label: 'Histórico' }, { value: 'custom', label: 'Rango' },
]

export function adminHash(value = window.location.hash) { return value === '#/admin' }
export function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value)) : 'Sin dato' }
export function metric(value: number | null, suffix = '') { return value === null ? '—' : `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value)}${suffix}` }
export function invitationLabel(status: string) { return status === 'accepted' ? 'Aceptada' : status === 'expired' ? 'Vencida' : 'Pendiente' }

