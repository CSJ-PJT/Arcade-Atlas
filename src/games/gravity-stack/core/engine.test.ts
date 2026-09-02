import { describe, expect, it } from 'vitest'
import { createEmptyBoard } from './clusters'
import { GravityStackEngine, pieceCollides } from './engine'
import { ENERGY_SYMBOLS, type Board, type Energy, type Piece, type PieceCell } from './types'

function cell(x: number, y: number, energy: Energy = 'nova'): PieceCell {
  return { x, y, energy, symbol: ENERGY_SYMBOLS[energy] }
}

function piece(cells: PieceCell[], shapeId = 'test'): Piece {
  return { id: 0, shapeId, cells, x: 0, y: 0 }
}

const horizontal = piece([cell(0, 0, 'nova'), cell(1, 0, 'solar'), cell(2, 0, 'ion')], 'beam')
const duo = piece([cell(0, 0, 'nova'), cell(1, 0, 'solar')], 'relay')

function filledCount(board: Board): number {
  return board.flat().filter(Boolean).length
}

describe('GravityStackEngine', () => {
  it('rejects board boundary collisions', () => {
    const board = createEmptyBoard()
    expect(pieceCollides(board, { ...duo, x: -1 })).toBe(true)
    expect(pieceCollides(board, { ...duo, x: 11 })).toBe(true)
    expect(pieceCollides(board, { ...duo, x: 3, y: 18 })).toBe(true)
  })

  it('detects collisions with occupied cells', () => {
    const board = createEmptyBoard()
    board[4][5] = { energy: 'terra', symbol: ENERGY_SYMBOLS.terra }
    expect(pieceCollides(board, { ...duo, x: 5, y: 4 })).toBe(true)
  })

  it('moves left and right while playing', () => {
    const engine = new GravityStackEngine('move', { pieceSequence: [duo, horizontal] })
    engine.start()
    const startX = engine.getSnapshot().activePiece?.x
    expect(engine.moveHorizontal(-1)).toBe(true)
    expect(engine.getSnapshot().activePiece?.x).toBe((startX ?? 0) - 1)
    expect(engine.moveHorizontal(1)).toBe(true)
    expect(engine.getSnapshot().activePiece?.x).toBe(startX)
  })

  it('rotates a piece clockwise', () => {
    const engine = new GravityStackEngine('rotate', { pieceSequence: [horizontal, duo] })
    engine.start()
    expect(engine.rotate()).toBe(true)
    const cells = engine.getSnapshot().activePiece?.cells ?? []
    expect(new Set(cells.map((next) => next.y)).size).toBe(3)
  })

  it('restores the original orientation when every horizontal correction collides', () => {
    const board = createEmptyBoard()
    for (let x = 2; x <= 8; x += 1) board[1][x] = { energy: 'terra', symbol: ENERGY_SYMBOLS.terra }
    const engine = new GravityStackEngine('blocked-rotate', { initialBoard: board, pieceSequence: [horizontal, duo] })
    engine.start()
    const before = engine.getSnapshot().activePiece
    expect(engine.rotate()).toBe(false)
    expect(engine.getSnapshot().activePiece).toEqual(before)
  })

  it('locks a hard-dropped piece into the board', () => {
    const engine = new GravityStackEngine('lock', { pieceSequence: [duo, horizontal] })
    engine.start()
    expect(engine.hardDrop()).toBe(true)
    expect(filledCount(engine.getSnapshot().board)).toBe(2)
  })

  it('clears a pre-existing full row after the next piece locks', () => {
    const board = createEmptyBoard()
    const energies: Energy[] = ['nova', 'solar', 'ion', 'plasma', 'terra']
    for (let x = 0; x < 12; x += 1) board[17][x] = { energy: energies[x % energies.length], symbol: ENERGY_SYMBOLS[energies[x % energies.length]] }
    const engine = new GravityStackEngine('full-row', { initialBoard: board, pieceSequence: [duo, horizontal] })
    engine.start()
    engine.hardDrop()
    const snapshot = engine.getSnapshot()
    expect(snapshot.totalClearedCells).toBe(12)
    expect(snapshot.score).toBe(240)
    expect(filledCount(snapshot.board)).toBe(2)
  })

  it('adds a server-authoritative obstacle row with one deterministic gap', () => {
    const engine = new GravityStackEngine('garbage', { pieceSequence: [duo, horizontal] })
    engine.start()
    expect(engine.addGarbageRow(4)).toBe(true)
    const bottom = engine.getSnapshot().board[17]
    expect(bottom.filter((next) => next?.obstacle)).toHaveLength(11)
    expect(bottom[4]).toBeNull()
    expect(bottom[0]?.symbol).toBe('×')
  })

  it('ends the run when an obstacle row would push occupied cells past the ceiling', () => {
    const board = createEmptyBoard()
    board[0][0] = { energy: 'terra', symbol: '■' }
    const engine = new GravityStackEngine('garbage-overflow', { initialBoard: board, pieceSequence: [duo, horizontal] })
    engine.start()
    expect(engine.getSnapshot().status).toBe('playing')
    expect(engine.addGarbageRow(4)).toBe(true)
    expect(engine.getSnapshot().status).toBe('gameOver')
  })

  it('enters game over when the spawn area is occupied', () => {
    const board = createEmptyBoard()
    board[0][5] = { energy: 'terra', symbol: ENERGY_SYMBOLS.terra }
    board[0][6] = { energy: 'terra', symbol: ENERGY_SYMBOLS.terra }
    const engine = new GravityStackEngine('game-over', { initialBoard: board, pieceSequence: [duo, horizontal] })
    engine.start()
    expect(engine.getSnapshot().status).toBe('gameOver')
    expect(engine.getSnapshot().activePiece).toBeNull()
  })

  it('ignores simulation ticks while paused', () => {
    const engine = new GravityStackEngine('pause', { pieceSequence: [duo, horizontal] })
    engine.start()
    engine.pause()
    const before = engine.getSnapshot()
    expect(engine.tick(10_000)).toBe(false)
    expect(engine.getSnapshot()).toEqual(before)
  })

  it('restores a versioned checkpoint with identical board, pieces, score and RNG continuation', () => {
    const original = new GravityStackEngine('checkpoint')
    original.start()
    original.execute('left')
    original.execute('rotate')
    original.execute('hardDrop')
    const checkpoint = original.getCheckpoint()
    const restored = new GravityStackEngine('checkpoint')
    expect(restored.restoreCheckpoint(checkpoint)).toBe(true)
    expect(restored.getCheckpoint()).toEqual(checkpoint)
    original.execute('hardDrop')
    restored.execute('hardDrop')
    expect(restored.getCheckpoint()).toEqual(original.getCheckpoint())
  })

  it('rejects checkpoints from another rules version', () => {
    const engine = new GravityStackEngine('version')
    const checkpoint = { ...engine.getCheckpoint(), rulesVersion: 'old-rules' }
    expect(engine.restoreCheckpoint(checkpoint)).toBe(false)
  })

  it('restart restores the initial deterministic state', () => {
    const engine = new GravityStackEngine('restart', { pieceSequence: [duo, horizontal] })
    engine.start()
    engine.hardDrop()
    engine.pause()
    engine.restart()
    const restarted = engine.getSnapshot()
    expect(restarted.status).toBe('playing')
    expect(restarted.score).toBe(0)
    expect(filledCount(restarted.board)).toBe(0)
    expect(restarted.activePiece?.shapeId).toBe('relay')
  })

  it('same seed and input sequence produces the same board and pieces', () => {
    const run = () => {
      const engine = new GravityStackEngine('deterministic-inputs')
      engine.start()
      for (const command of ['left', 'rotate', 'hardDrop', 'right', 'down', 'hardDrop'] as const) engine.execute(command)
      const snapshot = engine.getSnapshot()
      return { board: snapshot.board, active: snapshot.activePiece, next: snapshot.nextPiece, score: snapshot.score }
    }
    expect(run()).toEqual(run())
  })
})
