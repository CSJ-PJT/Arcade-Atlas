import { describe, expect, it } from 'vitest'
import { BOT_MOVE_INTERVALS, GravityBotEngine } from './gravityBot.mjs'

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
})
