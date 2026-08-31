import { describe, expect, it } from 'vitest'
import { applyColumnGravity, createEmptyBoard, findDischargeGroups, resolveCascades } from './clusters'
import { calculateDropInterval, calculateLevel, scoreGroup } from './scoring'
import { ENERGY_SYMBOLS, type Board, type Energy } from './types'

function put(board: Board, x: number, y: number, energy: Energy): void {
  board[y][x] = { energy, symbol: ENERGY_SYMBOLS[energy] }
}

describe('energy clusters', () => {
  it('does not remove a group smaller than six', () => {
    const board = createEmptyBoard()
    for (let x = 0; x < 5; x += 1) put(board, x, 17, 'nova')
    expect(findDischargeGroups(board)).toHaveLength(0)
    expect(resolveCascades(board).clearedCells).toBe(0)
  })

  it('removes an orthogonally connected group of six', () => {
    const board = createEmptyBoard()
    for (let x = 0; x < 6; x += 1) put(board, x, 17, 'nova')
    const result = resolveCascades(board)
    expect(result.clearedCells).toBe(6)
    expect(result.waves).toHaveLength(1)
    expect(result.score).toBe(60)
  })

  it('does not treat diagonal cells as connected', () => {
    const board = createEmptyBoard()
    for (let index = 0; index < 6; index += 1) put(board, index, 17 - index, 'ion')
    expect(findDischargeGroups(board)).toHaveLength(0)
  })

  it('removes multiple qualifying groups in the same wave', () => {
    const board = createEmptyBoard()
    for (let x = 0; x < 6; x += 1) {
      put(board, x, 17, 'nova')
      put(board, x + 6, 17, 'solar')
    }
    const result = resolveCascades(board)
    expect(result.waves).toHaveLength(1)
    expect(result.waves[0].groups).toHaveLength(2)
    expect(result.clearedCells).toBe(12)
    expect(result.score).toBe(120)
  })

  it('applies gravity independently to each column', () => {
    const board = createEmptyBoard()
    put(board, 0, 3, 'nova')
    put(board, 0, 8, 'solar')
    put(board, 4, 1, 'ion')
    const result = applyColumnGravity(board)
    expect(result[17][0]?.energy).toBe('solar')
    expect(result[16][0]?.energy).toBe('nova')
    expect(result[17][4]?.energy).toBe('ion')
  })

  it('resolves cascades and applies the wave multiplier', () => {
    const board = createEmptyBoard()
    for (let y = 10; y <= 12; y += 1) put(board, 0, y, 'nova')
    for (let x = 0; x < 6; x += 1) put(board, x, 13, 'solar')
    for (let y = 14; y <= 16; y += 1) put(board, 0, y, 'nova')
    const result = resolveCascades(board)
    expect(result.waves).toHaveLength(2)
    expect(result.waves.map((wave) => wave.score)).toEqual([60, 120])
    expect(result.score).toBe(180)
    expect(result.clearedCells).toBe(12)
  })
})

describe('score and speed', () => {
  it('awards the configured group bonus', () => {
    expect(scoreGroup(6)).toBe(60)
    expect(scoreGroup(8)).toBe(120)
  })

  it('levels up for every thirty cleared cells', () => {
    expect(calculateLevel(0)).toBe(1)
    expect(calculateLevel(29)).toBe(1)
    expect(calculateLevel(30)).toBe(2)
    expect(calculateLevel(91)).toBe(4)
  })

  it('never drops faster than 160ms', () => {
    expect(calculateDropInterval(1)).toBe(900)
    expect(calculateDropInterval(4)).toBe(690)
    expect(calculateDropInterval(100)).toBe(160)
  })
})
