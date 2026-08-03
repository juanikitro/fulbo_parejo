import { supabase } from '../lib/supabase'
import type { AdminAction } from './types'

export async function adminRequest<T>(action: AdminAction, body: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('Falta configurar Supabase.')
  const { data, error } = await supabase.functions.invoke('admin-metrics', { body: { action, ...body } })
  if (error) {
    const response = (error as { context?: Response }).context
    const errorBody = response ? await response.clone().json().catch(() => null) as { message?: string } | null : null
    throw new Error(errorBody?.message ?? error.message)
  }
  if (data?.message) throw new Error(data.message)
  return data as T
}

export async function isAdmin() {
  const data = await adminRequest<{ isAdmin: boolean }>('access')
  return data.isAdmin
}

