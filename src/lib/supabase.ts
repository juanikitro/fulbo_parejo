import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key) : null

export async function signInWithGoogle(redirectTo = window.location.origin) {
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
