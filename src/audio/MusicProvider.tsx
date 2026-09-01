import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { lobbyTrack, pickGameTrack, type MusicScope } from './musicCatalog'

const MUTE_KEY = 'arcade:music:muted:v1'
const MusicContext = createContext({ setScope: (_scope: MusicScope) => { void _scope } })

export function MusicProvider({ children }: PropsWithChildren) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scopeRef = useRef<MusicScope>('lobby')
  const unlockedRef = useRef(false)
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const [scope, setScopeState] = useState<MusicScope>('lobby')

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio || muted || !unlockedRef.current) return
    void audio.play().catch(() => {})
  }, [muted])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'none'
    audio.loop = true
    audio.volume = 0.34
    audioRef.current = audio
    const unlock = () => { unlockedRef.current = true; window.setTimeout(play, 150) }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [play])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    scopeRef.current = scope
    audio.pause()
    audio.currentTime = 0
    audio.loop = scope === 'lobby'
    audio.src = scope === 'lobby' ? lobbyTrack : pickGameTrack('')
    play()
  }, [play, scope])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => {
      if (scopeRef.current !== 'game') return
      audio.src = pickGameTrack(audio.src.replace(window.location.origin, ''))
      play()
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [play])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (muted) audio.pause()
    else play()
    localStorage.setItem(MUTE_KEY, String(muted))
  }, [muted, play])

  const value = useMemo(() => ({ setScope: setScopeState }), [])
  return <MusicContext.Provider value={value}>{children}<button className="music-toggle" type="button" aria-pressed={!muted} data-music-scope={scope} data-music-track={scope === 'lobby' ? lobbyTrack : 'game-pool'} onClick={() => { unlockedRef.current = true; setMuted((value) => !value) }}>{muted ? '음악 켜기' : '음악 끄기'}</button></MusicContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMusicScope(scope: MusicScope) {
  const music = useContext(MusicContext)
  useEffect(() => { music.setScope(scope) }, [music, scope])
}
