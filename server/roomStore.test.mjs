import { describe, expect, it } from 'vitest'
import { MAX_PLAYERS, RoomStore } from './roomStore.mjs'

function deterministicStore() {
  let id = 0
  return new RoomStore({ now: () => 1000, random: () => Buffer.alloc(6, 1), id: () => `p-${++id}` })
}

describe('multiplayer room store', () => {
  it('creates, joins and starts only when every player is ready', () => {
    const store = deterministicStore()
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
    const store = deterministicStore()
    const { room } = store.createRoom('1')
    for (let index = 2; index <= MAX_PLAYERS; index += 1) store.joinRoom(room.code, String(index))
    expect(() => store.joinRoom(room.code, 'overflow')).toThrow('ROOM_FULL')
  })

  it('rejects score regression and stale match progress', () => {
    const store = deterministicStore()
    const { room, player } = store.createRoom('Host')
    const guest = store.joinRoom(room.code, 'Guest')
    store.setReady(room, player.id, true)
    store.setReady(room, guest.player.id, true)
    const match = store.start(room)
    expect(store.updateProgress(room, player.id, { matchId: match.matchId, score: 100, level: 1, cleared: 6, gameStatus: 'playing' })).toBe(true)
    expect(store.updateProgress(room, player.id, { matchId: match.matchId, score: 50, level: 1, cleared: 6, gameStatus: 'playing' })).toBe(false)
    expect(store.updateProgress(room, player.id, { matchId: 'old', score: 120, level: 1, cleared: 6, gameStatus: 'playing' })).toBe(false)
  })
})
