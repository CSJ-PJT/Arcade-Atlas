import { ENERGIES, ENERGY_SYMBOLS, type Piece, type PieceCell, type Point } from './types'
import type { SeededRng } from './rng'

export interface PieceShape {
  id: string
  points: readonly Point[]
}

export const PIECE_SHAPES: readonly PieceShape[] = [
  { id: 'relay', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  { id: 'mast', points: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] },
  { id: 'wing', points: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  { id: 'pod', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  { id: 'kite', points: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
  { id: 'cup', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
  { id: 'beacon', points: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }] },
  { id: 'hook', points: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }] },
  { id: 'stair', points: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }] },
  { id: 'dish', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
] as const

export function normalizePieceCells(cells: PieceCell[]): PieceCell[] {
  const minX = Math.min(...cells.map((cell) => cell.x))
  const minY = Math.min(...cells.map((cell) => cell.y))
  return cells.map((cell) => ({ ...cell, x: cell.x - minX, y: cell.y - minY }))
}

export function rotatePieceCells(cells: PieceCell[]): PieceCell[] {
  return normalizePieceCells(
    cells.map((cell) => ({ ...cell, x: -cell.y, y: cell.x })),
  )
}

export function createRandomPiece(rng: SeededRng, id: number): Piece {
  const shape = PIECE_SHAPES[rng.int(PIECE_SHAPES.length)]
  const cells = shape.points.map((point) => {
    const energy = ENERGIES[rng.int(ENERGIES.length)]
    return { ...point, energy, symbol: ENERGY_SYMBOLS[energy] }
  })
  return { id, shapeId: shape.id, cells, x: 0, y: 0 }
}

export function pieceWidth(piece: Pick<Piece, 'cells'>): number {
  return Math.max(...piece.cells.map((cell) => cell.x)) + 1
}
