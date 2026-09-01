import type { User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { atlasAuthConfigured, getAtlasAuthClient } from './atlasAuthClient'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error' | 'unavailable'

type AuthContextValue = {
  status: AuthStatus
  user: User | null
  error: string
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  retry: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isE2eMode() {
  return import.meta.env.MODE === 'e2e'
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() => isE2eMode() ? 'authenticated' : atlasAuthConfigured ? 'loading' : 'unavailable')
  const [user, setUser] = useState<User | null>(() => isE2eMode() ? ({ id: 'arcade-e2e-user', aud: 'authenticated', role: 'authenticated' } as User) : null)
  const [error, setError] = useState('')

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
      setStatus('anonymous')
      return
    }
    const { data, error: userError } = await auth.auth.getUser()
    if (userError || !data.user) {
      setUser(null)
      setError(userError?.message ?? 'Atlas session validation failed')
      setStatus('error')
      return
    }
    setUser(data.user)
    setStatus('authenticated')
  }, [])

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
    return true
  }, [])

  const signOut = useCallback(async () => {
    const auth = getAtlasAuthClient()
    if (auth) await auth.auth.signOut()
    setUser(null)
    setError('')
    setStatus(auth ? 'anonymous' : 'unavailable')
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ status, user, error, signIn, signOut, retry: refresh }), [status, user, error, signIn, signOut, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAtlasAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
