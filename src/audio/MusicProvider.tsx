import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { lobbyTrack, pickGameTrack, type MusicScope } from './musicCatalog'

const MUTE_KEY = 'arcade:music:muted:v1'
const MusicContext = createContext({ setScope: (_scope: MusicScope) => { void _scope } })

export function MusicProvider({ children }: PropsWithChildren) {
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
  const gameAudioRef = useRef<HTMLAudioElement | null>(null)
  const scopeRef = useRef<MusicScope>('lobby')
  const unlockedRef = useRef(false)
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const [scope, setScopeState] = useState<MusicScope>('lobby')

  const play = useCallback(() => {
    const audio = scopeRef.current === 'lobby' ? lobbyAudioRef.current : gameAudioRef.current
    if (!audio || muted || !unlockedRef.current) return
    void audio.play().catch(() => {})
  }, [muted])

  useEffect(() => {
    const lobbyAudio = new Audio()
    const gameAudio = new Audio()
    lobbyAudio.preload = 'none'
    gameAudio.preload = 'none'
    lobbyAudio.src = lobbyTrack
    gameAudio.src = pickGameTrack('')
    lobbyAudio.loop = true
    gameAudio.loop = false
    lobbyAudio.volume = 0.34
    gameAudio.volume = 0.34
    lobbyAudioRef.current = lobbyAudio
    gameAudioRef.current = gameAudio
    const unlock = () => { unlockedRef.current = true; window.setTimeout(play, 150) }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      lobbyAudio.pause()
      gameAudio.pause()
      lobbyAudioRef.current = null
      gameAudioRef.current = null
    }
  }, [play])

  useEffect(() => {
    scopeRef.current = scope
    const inactive = scope === 'lobby' ? gameAudioRef.current : lobbyAudioRef.current
    inactive?.pause()
    play()
  }, [play, scope])

  useEffect(() => {
    const audio = gameAudioRef.current
    if (!audio) return
    const onEnded = () => {
      if (scopeRef.current !== 'game') return
      audio.src = pickGameTrack(new URL(audio.src).pathname)
      play()
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [play])

  useEffect(() => {
    if (muted) { lobbyAudioRef.current?.pause(); gameAudioRef.current?.pause() }
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
