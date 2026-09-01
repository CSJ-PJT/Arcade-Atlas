import { describe, expect, it } from 'vitest'
import { MAX_PLAYERS, RoomStore } from './roomStore.mjs'

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

  it('keeps normal rooms item-free and validates item attacks on the server', () => {
    const { store } = deterministicStore()
    const host = store.createRoom('Host', 'items')
    const guest = store.joinRoom(host.room.code, 'Guest')
    store.setReady(host.room, host.player.id, true)
    store.setReady(host.room, guest.player.id, true)
    const match = store.start(host.room)
    store.updateProgress(host.room, host.player.id, { matchId: match.matchId, score: 200, level: 1, cleared: 24, gameStatus: 'playing' })
    expect(host.player.items).toEqual({ pulse: 1, shield: 1 })
    const shield = store.useItem(host.room, host.player.id, 'shield')
    expect(shield?.targetId).toBe(host.player.id)
    expect(host.player.shielded).toBe(true)
    const pulse = store.useItem(host.room, host.player.id, 'pulse', guest.player.id)
    expect(pulse?.blocked).toBe(false)
    expect(host.player.items).toEqual({ pulse: 0, shield: 0 })
    expect(store.publicRoom(host.room).mode).toBe('items')
  })

  it('rejects score regression and stale match progress', () => {
    const { store } = deterministicStore()
    const { room, player } = store.createRoom('Host')
    const guest = store.joinRoom(room.code, 'Guest')
    store.setReady(room, player.id, true)
    store.setReady(room, guest.player.id, true)
    const match = store.start(room)
    expect(store.updateProgress(room, player.id, { matchId: match.matchId, score: 100, level: 1, cleared: 6, gameStatus: 'playing' })).toBe(true)
    expect(store.updateProgress(room, player.id, { matchId: match.matchId, score: 50, level: 1, cleared: 6, gameStatus: 'playing' })).toBe(false)
    expect(store.updateProgress(room, player.id, { matchId: 'old', score: 120, level: 1, cleared: 6, gameStatus: 'playing' })).toBe(false)
  })

  it('resumes the same player within the reconnect grace without losing progress', () => {
    const { store, advance } = deterministicStore()
    const host = store.createRoom('Host')
    const guest = store.joinRoom(host.room.code, 'Guest')
    store.setReady(host.room, host.player.id, true)
    store.setReady(host.room, guest.player.id, true)
    const match = store.start(host.room)
    store.updateProgress(host.room, guest.player.id, { matchId: match.matchId, score: 120, level: 2, cleared: 8, gameStatus: 'playing' })
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
    first.store.updateProgress(host.room, host.player.id, { matchId: match.matchId, score: 90, level: 1, cleared: 6, gameStatus: 'playing' })

    const second = deterministicStore()
    expect(second.store.hydrate(first.store.serialize())).toBe(true)
    const restored = second.store.rooms.get(host.room.code)
    expect(restored?.status).toBe('playing')
    expect([...restored.players.values()].every((player) => player.connected === false)).toBe(true)

    const resumed = second.store.resumeRoom(host.room.code, host.player.id, host.player.reconnectToken)
    expect(resumed.player.score).toBe(90)
    expect(resumed.room.matchId).toBe(match.matchId)
  })

  it('finishes when everyone is out and host rematch returns the room to a clean lobby', () => {
    const { store } = deterministicStore()
    const host = store.createRoom('Host')
    const guest = store.joinRoom(host.room.code, 'Guest')
    store.setReady(host.room, host.player.id, true)
    store.setReady(host.room, guest.player.id, true)
    const match = store.start(host.room)
    store.updateProgress(host.room, host.player.id, { matchId: match.matchId, score: 100, level: 1, cleared: 6, gameStatus: 'gameOver' })
    store.updateProgress(host.room, guest.player.id, { matchId: match.matchId, score: 80, level: 1, cleared: 6, gameStatus: 'gameOver' })
    expect(host.room.status).toBe('finished')

    expect(store.rematch(host.room, host.player.id)).toBe(true)
    expect(host.room.status).toBe('lobby')
    expect(host.room.matchId).toBe('')
    expect([...host.room.players.values()].every((player) => player.score === 0 && player.ready === false)).toBe(true)
  })
})
