import { describe, expect, it } from 'vitest'
import { createRandomPiece } from './pieces'
import { SeededRng } from './rng'

describe('SeededRng', () => {
  it('produces the same numbers for the same seed', () => {
    const left = new SeededRng('atlas-seed')
    const right = new SeededRng('atlas-seed')
    expect(Array.from({ length: 20 }, () => left.nextUint32()))
      .toEqual(Array.from({ length: 20 }, () => right.nextUint32()))
  })

  it('produces a different piece sequence for a different seed', () => {
    const sequence = (seed: string) => {
      const rng = new SeededRng(seed)
      return Array.from({ length: 12 }, (_, index) => createRandomPiece(rng, index))
        .map((piece) => `${piece.shapeId}:${piece.cells.map((cell) => cell.energy).join(',')}`)
    }
    expect(sequence('seed-a')).not.toEqual(sequence('seed-b'))
  })

  it('returns bounded integers', () => {
    const rng = new SeededRng('bounds')
    const values = Array.from({ length: 100 }, () => rng.int(5))
    expect(values.every((value) => value >= 0 && value < 5)).toBe(true)
  })
})
