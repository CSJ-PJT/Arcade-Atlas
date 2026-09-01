import { createContext, useContext, useEffect, useMemo } from 'react'
import type { PropsWithChildren } from 'react'
export type MusicScope = 'lobby' | 'game'

const MusicContext = createContext({ setScope: (_scope: MusicScope) => { void _scope } })

export function MusicProvider({ children }: PropsWithChildren) {
  const value = useMemo(() => ({ setScope: (_scope: MusicScope) => { void _scope } }), [])
  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
}

// Audio remains disabled until every track has public repository redistribution evidence.
// eslint-disable-next-line react-refresh/only-export-components
export function useMusicScope(scope: MusicScope) {
  const music = useContext(MusicContext)
  useEffect(() => { music.setScope(scope) }, [music, scope])
}
