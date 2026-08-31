import { describe, expect, it } from 'vitest'
import { PIECE_SHAPES, createRandomPiece } from './pieces'
import { SeededRng } from './rng'

describe('Gravity Stack module sizing', () => {
  it('uses only three or four cell modules', () => {
    expect(PIECE_SHAPES.length).toBeGreaterThanOrEqual(8)
    expect(PIECE_SHAPES.every((shape) => shape.points.length === 3 || shape.points.length === 4)).toBe(true)
    expect(PIECE_SHAPES.some((shape) => shape.points.length === 3)).toBe(true)
    expect(PIECE_SHAPES.some((shape) => shape.points.length === 4)).toBe(true)
  })

  it('never emits a two or five cell module', () => {
    const rng = new SeededRng('size-contract')
    const sizes = Array.from({ length: 500 }, (_, id) => createRandomPiece(rng, id).cells.length)
    expect(new Set(sizes)).toEqual(new Set([3, 4]))
  })
})
