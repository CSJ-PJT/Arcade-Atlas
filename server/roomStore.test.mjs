import { describe, expect, it } from 'vitest'
import { MAX_PLAYERS, RoomStore } from './roomStore.mjs'
import { GravityStackEngine } from '../src/games/gravity-stack/core/engine.ts'

function checkpoint(seed, { score = 0, cleared = 0, status = 'playing', maxChain = 0 } = {}) {
  const engine = new GravityStackEngine(seed)
  engine.start()
  return { ...engine.getCheckpoint(), score, totalClearedCells: cleared, level: 1 + Math.floor(cleared / 30), status, maxChain }
}

function deterministicStore() {
  let id = 0
  let time = 1000
  const store = new RoomStore({ now: () => time, random: (size) => Buffer.alloc(size, 1), id: () => `p-${++id}` })
  return { store, advance: (milliseconds) => { time += milliseconds } }
}

describe('multiplayer room store', () => {
  it('creates, joins and starts only when every player is ready', () => {
    const { store } = deterministicStore()
    const host = store.createRoom('Host')
    const guest = store.joinRoom(host.room.code, 'Guest')
    expect(store.canStart(host.room, host.player.id)).toBe(false)
    store.setReady(host.room, host.player.id, true)
    store.setReady(host.room, guest.player.id, true)
    expect(store.canStart(host.room, host.player.id)).toBe(true)
    const match = store.start(host.room)
    expect(match.seed).toMatch(/^MULTI-/)
    expect(host.room.status).toBe('playing')
    expect([...host.room.players.values()].every((player) => player.ready === false)).toBe(true)
  })

  it('limits a room to four real connections', () => {
    const { store } = deterministicStore()
    const { room } = store.createRoom('1')
    for (let index = 2; index <= MAX_PLAYERS; index += 1) store.joinRoom(room.code, String(index))
    expect(() => store.joinRoom(room.code, 'overflow')).toThrow('ROOM_FULL')
  })

  it('lets only the host manage ready AI players and removes bot-only rooms', () => {
    const { store } = deterministicStore()
    const host = store.createRoom('Host')
    const bot = store.addBot(host.room, host.player.id, 'ace')
    expect(bot.isBot).toBe(true)
    expect(bot.ready).toBe(true)
    expect(bot.botDifficulty).toBe('ace')
    expect(store.publicRoom(host.room).players.find((player) => player.id === bot.id)?.isBot).toBe(true)
    expect(store.setReady(host.room, bot.id, false)).toBe(false)
    expect(() => store.addBot(host.room, 'not-host', 'rookie')).toThrow('INVALID_STATE')
    expect(store.removeBot(host.room, 'not-host', bot.id)).toBe(false)
    expect(store.removeBot(host.room, host.player.id, bot.id)).toBe(true)
    const replacement = store.addBot(host.room, host.player.id, 'pilot')
    store.removePlayer(host.room, host.player.id)
    expect(store.rooms.has(host.room.code)).toBe(false)
    expect(replacement.isHost).toBe(false)
  })

  it('awards the six-item cycle per player and validates effects on the server', () => {
    const { store, advance } = deterministicStore()
    const host = store.createRoom('Host', 'items')
    const guest = store.joinRoom(host.room.code, 'Guest')
    store.setReady(host.room, host.player.id, true)
    store.setReady(host.room, guest.player.id, true)
    const match = store.start(host.room)
    store.applyEngineState(host.room, host.player.id, checkpoint(match.seed, { score: 600, cleared: 72 }))
    store.applyEngineState(host.room, guest.player.id, checkpoint(match.seed, { score: 100, cleared: 12 }))
    expect(host.player.items).toEqual({ pulse: 1, shield: 1, garbage: 1, rotationLock: 1, previewJam: 1, speedUp: 1 })
    expect(guest.player.items).toEqual({ pulse: 1, shield: 0, garbage: 0, rotationLock: 0, previewJam: 0, speedUp: 0 })
    const shield = store.useItem(host.room, host.player.id, 'shield')
    expect(shield?.targetId).toBe(host.player.id)
    expect(host.player.shielded).toBe(true)
    const blocked = store.useItem(host.room, guest.player.id, 'pulse', host.player.id)
    expect(blocked?.blocked).toBe(true)
    expect(host.player.shielded).toBe(false)
    const pulse = store.useItem(host.room, host.player.id, 'pulse', guest.player.id)
    expect(pulse?.blocked).toBe(false)
    expect(store.useItem(host.room, host.player.id, 'garbage', guest.player.id)?.gapColumn).toBeTypeOf('number')
    expect(store.useItem(host.room, host.player.id, 'rotationLock', guest.player.id)?.durationMs).toBe(8000)
    expect(store.useItem(host.room, host.player.id, 'previewJam', guest.player.id)?.durationMs).toBe(8000)
    expect(store.useItem(host.room, host.player.id, 'speedUp', guest.player.id)?.durationMs).toBe(8000)
    expect(store.effectActive(guest.player, 'rotationLockUntil')).toBe(true)
    expect(store.effectActive(guest.player, 'previewJamUntil')).toBe(true)
    expect(store.effectActive(guest.player, 'speedUpUntil')).toBe(true)
    advance(8001)
    expect(store.effectActive(guest.player, 'rotationLockUntil')).toBe(false)
    expect(host.player.items).toEqual({ pulse: 0, shield: 0, garbage: 0, rotationLock: 0, previewJam: 0, speedUp: 0 })
    expect(store.publicRoom(host.room).mode).toBe('items')
  })

  it('accepts only ordered human input sequences', () => {
    const { store } = deterministicStore()
    const { room, player } = store.createRoom('Host')
    const guest = store.joinRoom(room.code, 'Guest')
    store.setReady(room, player.id, true)
    store.setReady(room, guest.player.id, true)
    store.start(room)
    expect(store.acceptInput(room, player.id, 1)).toBe(true)
    expect(store.acceptInput(room, player.id, 1)).toBe(false)
    expect(store.acceptInput(room, player.id, 3)).toBe(false)
    expect(store.acceptInput(room, player.id, 2)).toBe(true)
    expect(store.acceptInput(room, guest.player.id, 1)).toBe(true)
  })

  it('resumes the same player within the reconnect grace without losing progress', () => {
    const { store, advance } = deterministicStore()
    const host = store.createRoom('Host')
    const guest = store.joinRoom(host.room.code, 'Guest')
    store.setReady(host.room, host.player.id, true)
    store.setReady(host.room, guest.player.id, true)
    const match = store.start(host.room)
    store.applyEngineState(host.room, guest.player.id, checkpoint(match.seed, { score: 120, cleared: 8 }))
    store.markDisconnected(host.room, guest.player.id)
    advance(29_999)
    store.sweep()

    const resumed = store.resumeRoom(host.room.code, guest.player.id, guest.player.reconnectToken)
    expect(resumed.player.connected).toBe(true)
    expect(resumed.player.score).toBe(120)
    expect(resumed.room.matchId).toBe(match.matchId)
    expect(resumed.room.players.size).toBe(2)
  })

  it('rejects an invalid reconnect token', () => {
    const { store } = deterministicStore()
    const { room, player } = store.createRoom('Host')
    store.markDisconnected(room, player.id)
    expect(() => store.resumeRoom(room.code, player.id, 'not-the-token')).toThrow('RESUME_FAILED')
  })

  it('expires disconnected players after the grace and transfers host ownership', () => {
    const { store, advance } = deterministicStore()
    const host = store.createRoom('Host')
    const guest = store.joinRoom(host.room.code, 'Guest')
    store.markDisconnected(host.room, host.player.id)
    advance(30_000)
    const result = store.sweep()

    expect(result.changed).toBe(true)
    expect(host.room.players.has(host.player.id)).toBe(false)
    expect(host.room.players.get(guest.player.id)?.isHost).toBe(true)
  })

  it('restores a persisted match and lets its players resume after a server restart', () => {
    const first = deterministicStore()
    const host = first.store.createRoom('Host')
    const guest = first.store.joinRoom(host.room.code, 'Guest')
    first.store.setReady(host.room, host.player.id, true)
    first.store.setReady(host.room, guest.player.id, true)
    const match = first.store.start(host.room)
    first.store.applyEngineState(host.room, host.player.id, checkpoint(match.seed, { score: 90, cleared: 6 }))

    const second = deterministicStore()
    expect(second.store.hydrate(first.store.serialize())).toBe(true)
    const restored = second.store.rooms.get(host.room.code)
    expect(restored?.status).toBe('playing')
    expect([...restored.players.values()].every((player) => player.connected === false)).toBe(true)

    const resumed = second.store.resumeRoom(host.room.code, host.player.id, host.player.reconnectToken)
    expect(resumed.player.score).toBe(90)
    expect(resumed.room.matchId).toBe(match.matchId)
  })

  it('rejects persisted rooms from an older rules or bot engine version', () => {
    const first = deterministicStore()
    first.store.createRoom('Host')
    const snapshot = first.store.serialize()
    const second = deterministicStore()
    expect(second.store.hydrate({ ...snapshot, rulesVersion: 'old-rules' })).toBe(false)
    expect(second.store.hydrate({ ...snapshot, botEngineVersion: 'old-bot' })).toBe(false)
  })

  it('finishes when everyone is out and host rematch returns the room to a clean lobby', () => {
    const { store } = deterministicStore()
    const host = store.createRoom('Host')
    const guest = store.joinRoom(host.room.code, 'Guest')
    store.setReady(host.room, host.player.id, true)
    store.setReady(host.room, guest.player.id, true)
    const match = store.start(host.room)
    store.applyEngineState(host.room, host.player.id, checkpoint(match.seed, { score: 100, cleared: 6, status: 'gameOver' }))
    store.applyEngineState(host.room, guest.player.id, checkpoint(match.seed, { score: 80, cleared: 6, status: 'gameOver' }))
    expect(host.room.status).toBe('finished')

    expect(store.rematch(host.room, host.player.id)).toBe(true)
    expect(host.room.status).toBe('lobby')
    expect(host.room.matchId).toBe('')
    expect([...host.room.players.values()].every((player) => player.score === 0 && player.ready === false)).toBe(true)
  })
})
