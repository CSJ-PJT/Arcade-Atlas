export const lobbyTrack = '/arcade/audio/gravity-lobby.mp3'

export const gameTracks = [
  '/arcade/audio/gravity-game-01.mp3',
  '/arcade/audio/gravity-game-02.mp3',
  '/arcade/audio/gravity-game-03.mp3',
  '/arcade/audio/gravity-game-04.mp3',
  '/arcade/audio/gravity-game-05.mp3',
  '/arcade/audio/gravity-game-06.mp3',
] as const

export type MusicScope = 'lobby' | 'game'

export function pickGameTrack(current: string, random = Math.random): string {
  const candidates = gameTracks.filter((track) => track !== current)
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] ?? gameTracks[0]
}
