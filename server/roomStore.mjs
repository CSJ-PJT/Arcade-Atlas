import { randomBytes, randomUUID } from 'node:crypto'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const MAX_PLAYERS = 4

function createCode(random = randomBytes) {
  const bytes = random(6)
  return Array.from(bytes, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('')
}

function cleanName(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16) || '탐사자'
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    ready: player.ready,
    connected: player.connected,
    score: player.score,
    level: player.level,
    cleared: player.cleared,
    gameStatus: player.gameStatus,
  }
}

export class RoomStore {
  constructor({ now = Date.now, random = randomBytes, id = randomUUID } = {}) {
    this.rooms = new Map()
    this.now = now
    this.random = random
    this.id = id
  }

  createRoom(name) {
    let code
    do code = createCode(this.random)
    while (this.rooms.has(code))
    const player = this.#newPlayer(name, true)
    const room = { code, status: 'lobby', seed: '', matchId: '', players: new Map([[player.id, player]]), createdAt: this.now() }
    this.rooms.set(code, room)
    return { room, player }
  }

  joinRoom(codeValue, name) {
    const code = String(codeValue ?? '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6)
    const room = this.rooms.get(code)
    if (!room) throw new Error('ROOM_NOT_FOUND')
    if (room.status !== 'lobby') throw new Error('MATCH_IN_PROGRESS')
    if (room.players.size >= MAX_PLAYERS) throw new Error('ROOM_FULL')
    const player = this.#newPlayer(name, false)
    room.players.set(player.id, player)
    return { room, player }
  }

  setReady(room, playerId, ready) {
    const player = room.players.get(playerId)
    if (!player || room.status !== 'lobby') return false
    player.ready = Boolean(ready)
    return true
  }

  canStart(room, playerId) {
    const player = room.players.get(playerId)
    return Boolean(player?.isHost && room.status === 'lobby' && room.players.size >= 2 && [...room.players.values()].every((entry) => entry.ready))
  }

  start(room) {
    room.status = 'playing'
    room.seed = `MULTI-${this.random(8).toString('hex')}`
    room.matchId = this.id()
    for (const player of room.players.values()) {
      player.ready = false
      player.score = 0
      player.level = 1
      player.cleared = 0
      player.gameStatus = 'playing'
    }
    return { matchId: room.matchId, seed: room.seed, startsAt: this.now() + 1200 }
  }

  updateProgress(room, playerId, payload) {
    if (room.status !== 'playing' || payload.matchId !== room.matchId) return false
    const player = room.players.get(playerId)
    if (!player) return false
    const score = Number(payload.score)
    const level = Number(payload.level)
    const cleared = Number(payload.cleared)
    if (![score, level, cleared].every(Number.isSafeInteger)) return false
    if (score < player.score || cleared < player.cleared || level < 1 || score > 100_000_000 || cleared > 1_000_000 || level > 100_000) return false
    player.score = score
    player.level = level
    player.cleared = cleared
    player.gameStatus = payload.gameStatus === 'gameOver' ? 'gameOver' : 'playing'
    if ([...room.players.values()].every((entry) => entry.gameStatus === 'gameOver')) room.status = 'finished'
    return true
  }

  removePlayer(room, playerId) {
    const wasHost = room.players.get(playerId)?.isHost
    room.players.delete(playerId)
    if (room.players.size === 0) {
      this.rooms.delete(room.code)
      return
    }
    if (wasHost) {
      const nextHost = room.players.values().next().value
      if (nextHost) nextHost.isHost = true
    }
  }

  sweep(maxAgeMs = 3_600_000) {
    const cutoff = this.now() - maxAgeMs
    for (const [code, room] of this.rooms) {
      if (room.players.size === 0 || room.createdAt < cutoff) this.rooms.delete(code)
    }
  }

  publicRoom(room) {
    return {
      code: room.code,
      status: room.status,
      matchId: room.matchId || null,
      players: [...room.players.values()].map(publicPlayer),
    }
  }

  #newPlayer(name, isHost) {
    return {
      id: this.id(), name: cleanName(name), isHost, ready: false, connected: true,
      score: 0, level: 1, cleared: 0, gameStatus: 'ready',
    }
  }
}
