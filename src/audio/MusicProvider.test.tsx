import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MusicProvider, useMusicScope } from './MusicProvider'

const play = vi.fn(() => Promise.resolve())
const pause = vi.fn()
const load = vi.fn()
let audioElements: HTMLAudioElement[]

function Scope({ value }: { value: 'lobby' | 'game' }) {
  useMusicScope(value)
  return <span>scope</span>
}

describe('MusicProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    play.mockClear()
    pause.mockClear()
    load.mockClear()
    audioElements = []
    class AudioMock {
      constructor() {
        const audio = document.createElement('audio')
        Object.defineProperties(audio, { play: { value: play }, pause: { value: pause }, load: { value: load } })
        audioElements.push(audio)
        return audio
      }
    }
    vi.stubGlobal('Audio', AudioMock)
  })

  it('starts only after an explicit user interaction and exposes a mute control', () => {
    render(<MusicProvider><Scope value="lobby" /></MusicProvider>)
    expect(play).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '음악 시작' }))
    expect(play).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '음악 끄기' }))
    expect(pause).toHaveBeenCalled()
    expect(localStorage.getItem('arcade:music-muted:v1')).toBe('true')
  })

  it('switches from the lobby track to an in-game-only track', () => {
    const view = render(<MusicProvider><Scope value="lobby" /></MusicProvider>)
    fireEvent.click(screen.getByRole('button', { name: '음악 시작' }))
    expect(audioElements[0].src).toContain('/arcade/audio/lobby.mp3')
    view.rerender(<MusicProvider><Scope value="game" /></MusicProvider>)
    expect(audioElements[1].src).toMatch(/\/arcade\/audio\/game-0[1-6]\.mp3$/)
    expect(audioElements[1].src).not.toContain('lobby.mp3')
  })
})
