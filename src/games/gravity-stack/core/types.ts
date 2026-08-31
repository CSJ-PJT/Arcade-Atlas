export const BOARD_WIDTH = 12
export const BOARD_HEIGHT = 18

export const ENERGIES = ['nova', 'solar', 'ion', 'plasma', 'terra'] as const
export type Energy = (typeof ENERGIES)[number]

export const ENERGY_SYMBOLS: Record<Energy, string> = {
  nova: '◆',
  solar: '●',
  ion: '▲',
  plasma: '✦',
  terra: '■',
}

export type GameStatus = 'ready' | 'playing' | 'paused' | 'gameOver'

export interface Cell {
  energy: Energy
  symbol: string
}

export interface PieceCell extends Cell {
  x: number
  y: number
}

export interface Piece {
  id: number
  shapeId: string
  cells: PieceCell[]
  x: number
  y: number
}

export type Board = Array<Array<Cell | null>>

export interface Point {
  x: number
  y: number
}

export interface DischargeGroup {
  energy: Energy
  cells: Point[]
}

export interface DischargeWave {
  index: number
  groups: DischargeGroup[]
  clearedCells: number
  score: number
}

export interface ResolutionResult {
  board: Board
  waves: DischargeWave[]
  clearedCells: number
  score: number
}

export interface EngineSnapshot {
  board: Board
  activePiece: Piece | null
  nextPiece: Piece
  status: GameStatus
  score: number
  level: number
  totalClearedCells: number
  maxChain: number
  seed: string
  dropIntervalMs: number
  revision: number
  lastWaveCount: number
}

export type GameCommand =
  | 'start'
  | 'left'
  | 'right'
  | 'rotate'
  | 'down'
  | 'hardDrop'
  | 'pauseToggle'
  | 'restart'
