import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key) : null

export function authRedirectUrl(configuredUrl: string | undefined, currentOrigin = window.location.origin) {
  return configuredUrl?.trim() || currentOrigin
}

export async function signInWithGoogle(redirectTo = authRedirectUrl(import.meta.env.VITE_SITE_URL)) {
  if (!supabase) throw new Error('Falta configurar Supabase.')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) throw new Error('Falta configurar Supabase.')
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
