export type MultiplayerGameStatus = 'ready' | 'playing' | 'gameOver'

export interface MultiplayerPlayer {
  id: string
  name: string
  isHost: boolean
  ready: boolean
  connected: boolean
  score: number
  level: number
  cleared: number
  gameStatus: MultiplayerGameStatus
}

export interface MultiplayerRoom {
  code: string
  status: 'lobby' | 'playing' | 'finished'
  matchId: string | null
  players: MultiplayerPlayer[]
}

export interface MatchStart {
  matchId: string
  seed: string
  startsAt: number
}
