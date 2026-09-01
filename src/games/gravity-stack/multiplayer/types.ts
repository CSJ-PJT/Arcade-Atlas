export type MultiplayerGameStatus = 'ready' | 'playing' | 'gameOver'
export type MultiplayerMode = 'normal' | 'items'
export type ItemType = 'pulse' | 'shield'

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
  items: Record<ItemType, number>
  shielded: boolean
}

export interface MultiplayerRoom {
  code: string
  status: 'lobby' | 'playing' | 'finished'
  matchId: string | null
  mode: MultiplayerMode
  players: MultiplayerPlayer[]
}

export interface ItemEvent { eventId: string; matchId: string; itemType: ItemType; sourceId: string; targetId: string; blocked: boolean }

export interface MatchStart {
  matchId: string
  seed: string
  startsAt: number
}
