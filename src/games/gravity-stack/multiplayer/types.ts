export type MultiplayerGameStatus = 'ready' | 'playing' | 'gameOver'
export type MultiplayerMode = 'normal' | 'items'
export type ItemType = 'pulse' | 'shield'
export type BotDifficulty = 'rookie' | 'pilot' | 'ace'

export interface MultiplayerPlayer {
  id: string
  name: string
  isHost: boolean
  isBot: boolean
  botDifficulty: BotDifficulty | null
  ready: boolean
  connected: boolean
  score: number
  level: number
  cleared: number
  gameStatus: MultiplayerGameStatus
  items: Record<ItemType, number>
  shielded: boolean
  botMoves?: number
  maxChain: number
  forfeited: boolean
  boardPreview: string
  dangerHeight: number
  lastWaveCount: number
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
  rulesVersion: string
  botEngineVersion: string
}
