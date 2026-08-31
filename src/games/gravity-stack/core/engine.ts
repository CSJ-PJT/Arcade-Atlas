import { SeededRng } from './rng'
import { createRandomPiece, pieceWidth, rotatePieceCells } from './pieces'
import { applyColumnGravity, cloneBoard, createEmptyBoard, resolveCascades } from './clusters'
import { calculateDropInterval, calculateLevel } from './scoring'
import { BOARD_HEIGHT, BOARD_WIDTH, type Board, type EngineSnapshot, type GameCommand, type GameStatus, type Piece } from './types'

interface EngineOptions {
  initialBoard?: Board
  pieceSequence?: Piece[]
}

function clonePiece(piece: Piece): Piece {
  return { ...piece, cells: piece.cells.map((cell) => ({ ...cell })) }
}

export class GravityStackEngine {
  readonly seed: string
  private rng: SeededRng
  private board: Board
  private activePiece: Piece | null = null
  private nextPiece: Piece
  private status: GameStatus = 'ready'
  private score = 0
  private totalClearedCells = 0
  private maxChain = 0
  private accumulatorMs = 0
  private pieceId = 0
  private revision = 0
  private lastWaveCount = 0
  private readonly initialBoard: Board
  private readonly initialPieceSequence: Piece[]
  private pieceSequenceIndex = 0

  constructor(seed: string, options: EngineOptions = {}) {
    this.seed = seed
    this.initialBoard = cloneBoard(options.initialBoard ?? createEmptyBoard())
    this.initialPieceSequence = (options.pieceSequence ?? []).map(clonePiece)
    this.board = cloneBoard(this.initialBoard)
    this.rng = new SeededRng(seed)
    this.nextPiece = this.makeNextPiece()
  }

  getSnapshot(): EngineSnapshot {
    const level = calculateLevel(this.totalClearedCells)
    return {
      board: cloneBoard(this.board),
      activePiece: this.activePiece ? clonePiece(this.activePiece) : null,
      nextPiece: clonePiece(this.nextPiece),
      status: this.status,
      score: this.score,
      level,
      totalClearedCells: this.totalClearedCells,
      maxChain: this.maxChain,
      seed: this.seed,
      dropIntervalMs: calculateDropInterval(level),
      revision: this.revision,
      lastWaveCount: this.lastWaveCount,
    }
  }

  start(): boolean {
    if (this.status !== 'ready') return false
    this.status = 'playing'
    this.bumpRevision()
    this.spawnNextPiece()
    return this.status === 'playing'
  }

  pause(): boolean {
    if (this.status !== 'playing') return false
    this.status = 'paused'
    this.bumpRevision()
    return true
  }

  resume(): boolean {
    if (this.status !== 'paused') return false
    this.status = 'playing'
    this.accumulatorMs = 0
    this.bumpRevision()
    return true
  }

  restart(): boolean {
    this.rng = new SeededRng(this.seed)
    this.board = cloneBoard(this.initialBoard)
    this.activePiece = null
    this.status = 'playing'
    this.score = 0
    this.totalClearedCells = 0
    this.maxChain = 0
    this.accumulatorMs = 0
    this.pieceId = 0
    this.pieceSequenceIndex = 0
    this.lastWaveCount = 0
    this.nextPiece = this.makeNextPiece()
    this.bumpRevision()
    this.spawnNextPiece()
    return this.status === 'playing'
  }

  tick(deltaMs: number): boolean {
    if (this.status !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return false
    this.accumulatorMs += deltaMs
    let changed = false
    while (this.status === 'playing') {
      const interval = calculateDropInterval(calculateLevel(this.totalClearedCells))
      if (this.accumulatorMs < interval) break
      this.accumulatorMs -= interval
      changed = this.stepDown() || changed
    }
    return changed
  }

  execute(command: GameCommand): boolean {
    switch (command) {
      case 'start': return this.start()
      case 'left': return this.moveHorizontal(-1)
      case 'right': return this.moveHorizontal(1)
      case 'rotate': return this.rotate()
      case 'down': return this.status === 'playing' ? this.stepDown() : false
      case 'hardDrop': return this.hardDrop()
      case 'pauseToggle': return this.status === 'playing' ? this.pause() : this.resume()
      case 'restart': return this.status === 'paused' || this.status === 'gameOver' ? this.restart() : false
    }
  }

  moveHorizontal(delta: -1 | 1): boolean {
    if (this.status !== 'playing' || !this.activePiece) return false
    const candidate = { ...this.activePiece, x: this.activePiece.x + delta }
    if (this.collides(candidate)) return false
    this.activePiece = candidate
    this.bumpRevision()
    return true
  }

  rotate(): boolean {
    if (this.status !== 'playing' || !this.activePiece) return false
    const rotatedCells = rotatePieceCells(this.activePiece.cells)
    for (const offset of [0, -1, 1, -2, 2]) {
      const candidate = { ...this.activePiece, cells: rotatedCells, x: this.activePiece.x + offset }
      if (!this.collides(candidate)) {
        this.activePiece = candidate
        this.bumpRevision()
        return true
      }
    }
    return false
  }

  hardDrop(): boolean {
    if (this.status !== 'playing' || !this.activePiece) return false
    while (!this.collides({ ...this.activePiece, y: this.activePiece.y + 1 })) {
      this.activePiece = { ...this.activePiece, y: this.activePiece.y + 1 }
    }
    this.lockActivePiece()
    return true
  }

  private stepDown(): boolean {
    if (!this.activePiece) return false
    const candidate = { ...this.activePiece, y: this.activePiece.y + 1 }
    if (!this.collides(candidate)) {
      this.activePiece = candidate
      this.bumpRevision()
      return true
    }
    this.lockActivePiece()
    return true
  }

  private lockActivePiece(): void {
    if (!this.activePiece) return
    for (const cell of this.activePiece.cells) {
      const x = this.activePiece.x + cell.x
      const y = this.activePiece.y + cell.y
      if (y >= 0 && y < BOARD_HEIGHT) this.board[y][x] = { energy: cell.energy, symbol: cell.symbol }
    }
    this.activePiece = null
    const resolution = resolveCascades(this.board)
    this.board = resolution.board
    this.score += resolution.score
    this.totalClearedCells += resolution.clearedCells
    this.lastWaveCount = resolution.waves.length
    this.maxChain = Math.max(this.maxChain, resolution.waves.length)
    this.bumpRevision()
    this.spawnNextPiece()
  }

  private spawnNextPiece(): void {
    const piece = clonePiece(this.nextPiece)
    piece.x = Math.floor((BOARD_WIDTH - pieceWidth(piece)) / 2)
    piece.y = 0
    this.nextPiece = this.makeNextPiece()
    if (this.collides(piece)) {
      this.activePiece = null
      this.status = 'gameOver'
      this.bumpRevision()
      return
    }
    this.activePiece = piece
    this.bumpRevision()
  }

  private makeNextPiece(): Piece {
    const scripted = this.initialPieceSequence[this.pieceSequenceIndex]
    const piece = scripted ? clonePiece(scripted) : createRandomPiece(this.rng, this.pieceId)
    if (scripted) this.pieceSequenceIndex += 1
    piece.id = this.pieceId
    this.pieceId += 1
    return piece
  }

  private collides(piece: Piece): boolean {
    return pieceCollides(this.board, piece)
  }

  private bumpRevision(): void {
    this.revision += 1
  }
}

export function pieceCollides(board: Board, piece: Piece): boolean {
  return piece.cells.some((cell) => {
    const x = piece.x + cell.x
    const y = piece.y + cell.y
    if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return true
    return y >= 0 && board[y][x] !== null
  })
}

export { applyColumnGravity }
