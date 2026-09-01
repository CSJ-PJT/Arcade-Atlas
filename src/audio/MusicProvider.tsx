import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useI18n } from '../i18n/I18nProvider'

export type MusicScope = 'lobby' | 'game'

const LOBBY_TRACK = '/arcade/audio/lobby.mp3'
const GAME_TRACKS = [
  '/arcade/audio/game-01.mp3', '/arcade/audio/game-02.mp3', '/arcade/audio/game-03.mp3',
  '/arcade/audio/game-04.mp3', '/arcade/audio/game-05.mp3', '/arcade/audio/game-06.mp3',
] as const
const MUTE_STORAGE_KEY = 'arcade:music-muted:v1'

type MusicContextValue = { setScope: (scope: MusicScope) => void }
const MusicContext = createContext<MusicContextValue>({ setScope: () => undefined })

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_STORAGE_KEY) === 'true' }
  catch { return false }
}

function writeMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_STORAGE_KEY, String(muted)) }
  catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
}

function nextGameTrack(previous: string): string {
  const candidates = GAME_TRACKS.filter((track) => track !== previous)
  return candidates[Math.floor(Math.random() * candidates.length)] ?? GAME_TRACKS[0]
}

export function MusicProvider({ children }: PropsWithChildren) {
  const { t } = useI18n()
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
  const gameAudioRef = useRef<HTMLAudioElement | null>(null)
  const scopeRef = useRef<MusicScope>('lobby')
  const activatedRef = useRef(false)
  const previousGameTrackRef = useRef('')
  const [activated, setActivated] = useState(false)
  const [muted, setMuted] = useState(readMuted)
  const mutedRef = useRef(muted)

  const selectGameTrack = useCallback(() => {
    const audio = gameAudioRef.current
    if (!audio) return
    const source = nextGameTrack(previousGameTrackRef.current)
    previousGameTrackRef.current = source
    audio.src = source
    audio.load()
  }, [])

  const playCurrentScope = useCallback(() => {
    if (!activatedRef.current || mutedRef.current) return
    const lobbyAudio = lobbyAudioRef.current
    const gameAudio = gameAudioRef.current
    if (!lobbyAudio || !gameAudio) return
    if (scopeRef.current === 'lobby') {
      gameAudio.pause()
      if (!lobbyAudio.src) {
        lobbyAudio.src = LOBBY_TRACK
        lobbyAudio.load()
      }
      void lobbyAudio.play().catch(() => undefined)
      return
    }
    lobbyAudio.pause()
    if (!gameAudio.src) selectGameTrack()
    void gameAudio.play().catch(() => undefined)
  }, [selectGameTrack])

  const activate = useCallback(() => {
    if (!activatedRef.current) {
      activatedRef.current = true
      setActivated(true)
    }
    playCurrentScope()
  }, [playCurrentScope])

  useEffect(() => {
    const lobbyAudio = new Audio()
    const gameAudio = new Audio()
    for (const audio of [lobbyAudio, gameAudio]) {
      audio.preload = 'none'
      audio.volume = 0.35
    }
    lobbyAudio.loop = true
    gameAudio.loop = false
    lobbyAudioRef.current = lobbyAudio
    gameAudioRef.current = gameAudio

    const onGameEnded = () => {
      selectGameTrack()
      playCurrentScope()
    }
    const onFirstInteraction = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.music-toggle')) return
      activate()
    }
    gameAudio.addEventListener('ended', onGameEnded)
    document.addEventListener('pointerdown', onFirstInteraction, { once: true, capture: true })
    document.addEventListener('keydown', onFirstInteraction, { once: true, capture: true })
    return () => {
      document.removeEventListener('pointerdown', onFirstInteraction, true)
      document.removeEventListener('keydown', onFirstInteraction, true)
      gameAudio.removeEventListener('ended', onGameEnded)
      lobbyAudio.pause()
      gameAudio.pause()
      lobbyAudioRef.current = null
      gameAudioRef.current = null
    }
  }, [activate, playCurrentScope, selectGameTrack])

  const setScope = useCallback((scope: MusicScope) => {
    if (scopeRef.current === scope) return
    scopeRef.current = scope
    playCurrentScope()
  }, [playCurrentScope])

  const toggleMusic = () => {
    if (!activatedRef.current) {
      mutedRef.current = false
      setMuted(false)
      writeMuted(false)
      activate()
      return
    }
    const nextMuted = !mutedRef.current
    mutedRef.current = nextMuted
    setMuted(nextMuted)
    writeMuted(nextMuted)
    if (nextMuted) {
      lobbyAudioRef.current?.pause()
      gameAudioRef.current?.pause()
    } else playCurrentScope()
  }

  const value = useMemo(() => ({ setScope }), [setScope])
  const buttonLabel = !activated ? t('music.start', '음악 시작') : muted ? t('music.on', '음악 켜기') : t('music.off', '음악 끄기')

  return (
    <MusicContext.Provider value={value}>
      {children}
      <button className="music-toggle" type="button" aria-pressed={activated && !muted} onClick={toggleMusic}>{buttonLabel}</button>
    </MusicContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMusicScope(scope: MusicScope) {
  const music = useContext(MusicContext)
  useEffect(() => { music.setScope(scope) }, [music, scope])
}
