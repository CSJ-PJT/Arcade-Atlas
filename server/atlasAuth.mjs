const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || ''

export const atlasAuthRequired = process.env.ARCADE_AUTH_REQUIRED === 'true'

export async function validateAtlasAccount(accessToken, request = fetch) {
  if (!atlasAuthRequired) return { id: 'local-player', nickname: '' }
  if (!url || !publishableKey || typeof accessToken !== 'string' || accessToken.length < 20) return null

  const headers = { apikey: publishableKey, authorization: `Bearer ${accessToken}` }
  const userResponse = await request(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(5000) })
  if (!userResponse.ok) return null
  const user = await userResponse.json()
  if (!user?.id) return null

  const profileResponse = await request(`${url}/rest/v1/sketchfy_profiles?id=eq.${encodeURIComponent(user.id)}&select=id,nickname&limit=1`, { headers, signal: AbortSignal.timeout(5000) })
  if (!profileResponse.ok) return null
  const profiles = await profileResponse.json()
  const profile = Array.isArray(profiles) ? profiles[0] : null
  if (!profile?.id || typeof profile.nickname !== 'string' || !profile.nickname.trim()) return null
  return { id: user.id, email: typeof user.email === 'string' ? user.email : '', nickname: profile.nickname.trim().slice(0, 16) }
}
