import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const MAX_PLAYERS = 4
export const RECONNECT_GRACE_MS = 30_000
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000
export const SNAPSHOT_VERSION = 1

function createCode(random = randomBytes) {
  const bytes = random(6)
  return Array.from(bytes, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join('')
}

function cleanName(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16) || '탐사자'
}

function safeTokenEqual(left, right) {
  const a = Buffer.from(String(left ?? ''))
  const b = Buffer.from(String(right ?? ''))
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b)
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
    const time = this.now()
    const room = {
      code, status: 'lobby', seed: '', matchId: '', startsAt: 0,
      players: new Map([[player.id, player]]), createdAt: time, updatedAt: time,
    }
    this.rooms.set(code, room)
    return { room, player }
  }

  joinRoom(codeValue, name) {
    const code = this.#normalizeCode(codeValue)
    const room = this.rooms.get(code)
    if (!room) throw new Error('ROOM_NOT_FOUND')
    if (room.status !== 'lobby') throw new Error('MATCH_IN_PROGRESS')
    if (room.players.size >= MAX_PLAYERS) throw new Error('ROOM_FULL')
    const player = this.#newPlayer(name, false)
    room.players.set(player.id, player)
    this.#touch(room)
    return { room, player }
  }

  resumeRoom(codeValue, playerIdValue, reconnectToken) {
    const room = this.rooms.get(this.#normalizeCode(codeValue))
    const playerId = String(playerIdValue ?? '')
    const player = room?.players.get(playerId)
    if (!room || !player || !safeTokenEqual(player.reconnectToken, reconnectToken)) throw new Error('RESUME_FAILED')
    player.connected = true
    player.disconnectedAt = null
    this.#touch(room)
    return { room, player }
  }

  setReady(room, playerId, ready) {
    const player = room.players.get(playerId)
    if (!player?.connected || room.status !== 'lobby') return false
    player.ready = Boolean(ready)
    this.#touch(room)
    return true
  }

  canStart(room, playerId) {
    const player = room.players.get(playerId)
    const players = [...room.players.values()]
    return Boolean(player?.isHost && room.status === 'lobby' && players.length >= 2 && players.every((entry) => entry.connected && entry.ready))
  }

  start(room) {
    room.status = 'playing'
    room.seed = `MULTI-${this.random(8).toString('hex')}`
    room.matchId = this.id()
    room.startsAt = this.now() + 1200
    for (const player of room.players.values()) {
      player.ready = false
      player.score = 0
      player.level = 1
      player.cleared = 0
      player.gameStatus = 'playing'
    }
    this.#touch(room)
    return this.matchState(room)
  }

  matchState(room) {
    return { matchId: room.matchId, seed: room.seed, startsAt: room.startsAt }
  }

  updateProgress(room, playerId, payload) {
    if (room.status !== 'playing' || payload.matchId !== room.matchId) return false
    const player = room.players.get(playerId)
    if (!player?.connected) return false
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
    this.#touch(room)
    return true
  }

  rematch(room, playerId) {
    const player = room.players.get(playerId)
    if (!player?.isHost || room.status !== 'finished') return false
    room.status = 'lobby'
    room.seed = ''
    room.matchId = ''
    room.startsAt = 0
    for (const entry of room.players.values()) {
      entry.ready = false
      entry.score = 0
      entry.level = 1
      entry.cleared = 0
      entry.gameStatus = 'ready'
    }
    this.#touch(room)
    return true
  }

  markDisconnected(room, playerId) {
    const player = room.players.get(playerId)
    if (!player) return false
    player.connected = false
    player.ready = false
    player.disconnectedAt = this.now()
    this.#touch(room)
    return true
  }

  removePlayer(room, playerId) {
    const wasHost = room.players.get(playerId)?.isHost
    if (!room.players.delete(playerId)) return false
    if (room.players.size === 0) {
      this.rooms.delete(room.code)
      return true
    }
    if (wasHost) {
      const players = [...room.players.values()]
      const nextHost = players.find((entry) => entry.connected) ?? players[0]
      if (nextHost) nextHost.isHost = true
    }
    if (room.status === 'playing' && room.players.size === 1) room.status = 'finished'
    this.#touch(room)
    return true
  }

  sweep({ reconnectGraceMs = RECONNECT_GRACE_MS, roomIdleTtlMs = ROOM_IDLE_TTL_MS } = {}) {
    const now = this.now()
    const changedRooms = []
    let changed = false
    for (const [code, room] of this.rooms) {
      let roomChanged = false
      for (const player of [...room.players.values()]) {
        if (!player.connected && player.disconnectedAt !== null && now - player.disconnectedAt >= reconnectGraceMs) {
          this.removePlayer(room, player.id)
          changed = true
          roomChanged = true
        }
      }
      if (!this.rooms.has(code)) continue
      if (now - room.updatedAt >= roomIdleTtlMs) {
        this.rooms.delete(code)
        changed = true
      }
      else if (roomChanged) changedRooms.push(room)
    }
    return { changed, rooms: changedRooms }
  }

  publicRoom(room) {
    return {
      code: room.code,
      status: room.status,
      matchId: room.matchId || null,
      players: [...room.players.values()].map(publicPlayer),
    }
  }

  serialize() {
    return {
      version: SNAPSHOT_VERSION,
      rooms: [...this.rooms.values()].map((room) => ({ ...room, players: [...room.players.values()] })),
    }
  }

  hydrate(snapshot) {
    if (!snapshot || snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.rooms)) return false
    const now = this.now()
    this.rooms.clear()
    for (const source of snapshot.rooms) {
      if (!source || typeof source.code !== 'string' || !Array.isArray(source.players)) continue
      const players = new Map()
      for (const entry of source.players) {
        if (!entry?.id || !entry?.reconnectToken) continue
        players.set(String(entry.id), {
          id: String(entry.id), reconnectToken: String(entry.reconnectToken), name: cleanName(entry.name),
          isHost: Boolean(entry.isHost), ready: false, connected: false, disconnectedAt: now,
          score: Number.isSafeInteger(entry.score) ? entry.score : 0,
          level: Number.isSafeInteger(entry.level) ? entry.level : 1,
          cleared: Number.isSafeInteger(entry.cleared) ? entry.cleared : 0,
          gameStatus: entry.gameStatus === 'gameOver' ? 'gameOver' : entry.gameStatus === 'playing' ? 'playing' : 'ready',
        })
      }
      if (players.size === 0) continue
      const room = {
        code: this.#normalizeCode(source.code),
        status: ['lobby', 'playing', 'finished'].includes(source.status) ? source.status : 'lobby',
        seed: String(source.seed ?? ''), matchId: String(source.matchId ?? ''),
        startsAt: Number(source.startsAt) || 0, players,
        createdAt: Number(source.createdAt) || now, updatedAt: Number(source.updatedAt) || now,
      }
      this.rooms.set(room.code, room)
    }
    return true
  }

  #newPlayer(name, isHost) {
    return {
      id: this.id(), reconnectToken: this.random(24).toString('base64url'), name: cleanName(name),
      isHost, ready: false, connected: true, disconnectedAt: null,
      score: 0, level: 1, cleared: 0, gameStatus: 'ready',
    }
  }

  #normalizeCode(value) {
    return String(value ?? '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6)
  }

  #touch(room) {
    room.updatedAt = this.now()
  }
}
