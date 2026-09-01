import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

export const atlasAuthConfigured = Boolean(url && publishableKey)

let client: SupabaseClient | null = null

export function getAtlasAuthClient() {
  if (!atlasAuthConfigured) return null
  client ??= createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
