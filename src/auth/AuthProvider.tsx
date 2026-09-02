import type { User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { atlasAuthConfigured, getAtlasAuthClient } from './atlasAuthClient'
import { getSharedAtlasProfile, type AtlasProfile } from './atlasProfile'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error' | 'unavailable'
export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

type AuthContextValue = {
  status: AuthStatus
  user: User | null
  profile: AtlasProfile | null
  profileStatus: ProfileStatus
  profileError: string
  error: string
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  retry: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isE2eMode() {
  return import.meta.env.MODE === 'e2e'
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() => isE2eMode() ? 'authenticated' : atlasAuthConfigured ? 'loading' : 'unavailable')
  const [user, setUser] = useState<User | null>(() => isE2eMode() ? ({ id: 'arcade-e2e-user', aud: 'authenticated', role: 'authenticated' } as User) : null)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<AtlasProfile | null>(() => isE2eMode() ? ({ id: 'arcade-e2e-user', nickname: 'E2E Pilot', avatar_seed: 'pilot', country_code: 'KR', preferred_language: 'ko', timezone: 'Asia/Seoul', native_language: 'ko', learning_language: 'ja', korean_level: 'native', daily_learning_goal: 10, show_romanization: true, show_english_translation: true, games_played: 0, wins: 0, total_score: 0 }) : null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>(() => isE2eMode() ? 'ready' : 'idle')
  const [profileError, setProfileError] = useState('')

  const loadProfile = useCallback(async (nextUser: User) => {
    const auth = getAtlasAuthClient()
    if (!auth) return
    setProfileStatus('loading')
    setProfileError('')
    const { data, error: loadError } = await getSharedAtlasProfile(auth, nextUser)
    if (loadError) {
      setProfile(null)
      setProfileError(loadError.message)
      setProfileStatus('error')
      return
    }
    setProfile(data)
    setProfileStatus(data ? 'ready' : 'missing')
  }, [])

  const refresh = useCallback(async () => {
    if (isE2eMode()) return
    const auth = getAtlasAuthClient()
    if (!auth) {
      setStatus('unavailable')
      return
    }
    setStatus('loading')
    setError('')
    const { data: sessionData, error: sessionError } = await auth.auth.getSession()
    if (sessionError) {
      setUser(null)
      setError(sessionError.message)
      setStatus('error')
      return
    }
    if (!sessionData.session) {
      setUser(null)
      setProfile(null)
      setProfileStatus('idle')
      setStatus('anonymous')
      return
    }
    const { data, error: userError } = await auth.auth.getUser()
    if (userError || !data.user) {
      setUser(null)
      setProfile(null)
      setProfileStatus('idle')
      setError(userError?.message ?? 'Atlas session validation failed')
      setStatus('error')
      return
    }
    setUser(data.user)
    setStatus('authenticated')
    await loadProfile(data.user)
  }, [loadProfile])

  useEffect(() => {
    if (isE2eMode()) return
    const auth = getAtlasAuthClient()
    if (!auth) return
    let active = true
    queueMicrotask(() => {
      if (active) void refresh()
    })
    const { data } = auth.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setError('')
      if (!session?.user) {
        setUser(null)
        setProfile(null)
        setProfileStatus('idle')
        setStatus('anonymous')
        return
      }
      setStatus('loading')
      queueMicrotask(() => {
        if (active) void refresh()
      })
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getAtlasAuthClient()
    if (!auth) {
      setStatus('unavailable')
      return false
    }
    setStatus('loading')
    setError('')
    const { data, error: signInError } = await auth.auth.signInWithPassword({ email, password })
    if (signInError || !data.user) {
      setUser(null)
      setError(signInError?.message ?? 'Atlas sign-in failed')
      setStatus('anonymous')
      return false
    }
    setUser(data.user)
    setStatus('authenticated')
    await loadProfile(data.user)
    return true
  }, [loadProfile])

  const signOut = useCallback(async () => {
    const auth = getAtlasAuthClient()
    if (auth) await auth.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileStatus('idle')
    setProfileError('')
    setError('')
    setStatus(auth ? 'anonymous' : 'unavailable')
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user)
  }, [loadProfile, user])

  const value = useMemo<AuthContextValue>(() => ({ status, user, profile, profileStatus, profileError, error, signIn, signOut, retry: refresh, refreshProfile }), [status, user, profile, profileStatus, profileError, error, signIn, signOut, refresh, refreshProfile])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAtlasAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
