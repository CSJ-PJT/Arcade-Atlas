import { describe, expect, it } from 'vitest'
import { BOT_MOVE_INTERVALS, GravityBotEngine } from './gravityBot.mjs'
import { GravityStackEngine } from '../src/games/gravity-stack/core/engine.ts'

describe('GravityBotEngine', () => {
  it('plays a deterministic independent board from the match seed', () => {
    const first = new GravityBotEngine('BOT-SEED', 'pilot')
    const second = new GravityBotEngine('BOT-SEED', 'pilot')
    for (let index = 0; index < 30; index += 1) { first.step(); second.step() }
    expect(first.snapshot()).toEqual(second.snapshot())
    expect(first.snapshot().moves).toBeGreaterThan(0)
  })

  it('supports bounded difficulty pacing and replay recovery', () => {
    expect(BOT_MOVE_INTERVALS.rookie).toBeGreaterThan(BOT_MOVE_INTERVALS.pilot)
    expect(BOT_MOVE_INTERVALS.pilot).toBeGreaterThan(BOT_MOVE_INTERVALS.ace)
    const live = new GravityBotEngine('RECOVER', 'ace'); live.replay(12)
    const recovered = new GravityBotEngine('RECOVER', 'ace'); recovered.replay(live.snapshot().moves)
    expect(recovered.snapshot()).toEqual(live.snapshot())
  })

  it('keeps the fair piece seed while distinct bot slots produce different decisions', () => {
    const first = new GravityBotEngine('SHARED-SEED', 'rookie', 'slot-a')
    const second = new GravityBotEngine('SHARED-SEED', 'rookie', 'slot-b')
    first.replay(18)
    second.replay(18)
    expect(first.snapshot().board).not.toEqual(second.snapshot().board)
  })

  it('applies the same two-cell gravity pulse command to human and AI engines', () => {
    const human = new GravityStackEngine('PULSE')
    human.start()
    const bot = new GravityBotEngine('PULSE', 'pilot', 'pulse-bot')
    human.forceDropCells(2)
    bot.forceDropCells(2)
    expect(bot.engine.getSnapshot().activePiece?.y).toBe(human.getSnapshot().activePiece?.y)
  })

  it('applies the same deterministic obstacle row to human and AI engines', () => {
    const human = new GravityStackEngine('GARBAGE')
    human.start()
    const bot = new GravityBotEngine('GARBAGE', 'pilot', 'garbage-bot')
    human.addGarbageRow(4)
    bot.addGarbageRow(4)
    expect(bot.engine.getSnapshot().board).toEqual(human.getSnapshot().board)
    expect(bot.engine.getSnapshot().activePiece).toEqual(human.getSnapshot().activePiece)
  })
})
