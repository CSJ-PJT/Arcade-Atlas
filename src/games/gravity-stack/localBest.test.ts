import { describe, expect, it, vi } from 'vitest'
import { GRAVITY_STACK_BEST_KEY, readBestScore, writeBestScore } from './localBest'

describe('local best score', () => {
  it('ignores missing, malformed, negative, and fractional values', () => {
    for (const raw of [null, 'broken', '-1', '3.14', 'Infinity']) {
      expect(readBestScore({ getItem: () => raw })).toBe(0)
    }
  })

  it('reads a valid safe integer', () => {
    expect(readBestScore({ getItem: () => '1230' })).toBe(1230)
  })

  it('writes only valid scores and tolerates storage errors', () => {
    const setItem = vi.fn()
    writeBestScore(250, { setItem })
    writeBestScore(-1, { setItem })
    expect(setItem).toHaveBeenCalledOnce()
    expect(setItem).toHaveBeenCalledWith(GRAVITY_STACK_BEST_KEY, '250')
    expect(() => writeBestScore(10, { setItem: () => { throw new Error('disabled') } })).not.toThrow()
  })
})
