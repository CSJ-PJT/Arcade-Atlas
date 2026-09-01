import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const MAX_PLAYERS = 4
export const RECONNECT_GRACE_MS = 30_000
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000
export const SNAPSHOT_VERSION = 1
export const ITEM_CHARGE_CELLS = 12

function cleanMode(value) { return value === 'items' ? 'items' : 'normal' }

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
    isBot: player.isBot,
    botDifficulty: player.botDifficulty,
    ready: player.ready,
    connected: player.connected,
    score: player.score,
    level: player.level,
    cleared: player.cleared,
    gameStatus: player.gameStatus,
    items: { ...player.items },
    shielded: player.shielded,
    botMoves: player.isBot ? player.botMoves : undefined,
  }
}

export class RoomStore {
  constructor({ now = Date.now, random = randomBytes, id = randomUUID } = {}) {
    this.rooms = new Map()
    this.now = now
    this.random = random
    this.id = id
  }

  createRoom(name, mode = 'normal') {
    let code
    do code = createCode(this.random)
    while (this.rooms.has(code))
    const player = this.#newPlayer(name, true)
    const time = this.now()
    const room = {
      code, mode: cleanMode(mode), status: 'lobby', seed: '', matchId: '', startsAt: 0, itemSequence: 0,
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

  addBot(room, playerId, difficulty = 'pilot') {
    const host = room.players.get(playerId)
    if (!host?.isHost || room.status !== 'lobby') throw new Error('INVALID_STATE')
    if (room.players.size >= MAX_PLAYERS) throw new Error('ROOM_FULL')
    const botCount = [...room.players.values()].filter((player) => player.isBot).length
    const bot = this.#newBot(botCount + 1, difficulty)
    room.players.set(bot.id, bot)
    this.#touch(room)
    return bot
  }

  removeBot(room, playerId, botId) {
    const host = room.players.get(playerId)
    const bot = room.players.get(String(botId ?? ''))
    if (!host?.isHost || room.status !== 'lobby' || !bot?.isBot) return false
    room.players.delete(bot.id)
    this.#touch(room)
    return true
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
    if (!player?.connected || player.isBot || room.status !== 'lobby') return false
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
      player.botMoves = 0
      player.items = { pulse: 0, shield: 0 }
      player.itemMilestone = 0
      player.shielded = false
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
    const clearedDelta = cleared - player.cleared
    const scoreDelta = score - player.score
    if (scoreDelta < 0 || clearedDelta < 0 || clearedDelta > 216 || (clearedDelta > 0 && clearedDelta < 6)) return false
    if (level !== 1 + Math.floor(cleared / 30) || scoreDelta > clearedDelta * 1000 || score > 100_000_000 || cleared > 1_000_000) return false
    player.score = score
    player.level = level
    player.cleared = cleared
    player.gameStatus = payload.gameStatus === 'gameOver' ? 'gameOver' : 'playing'
    if (player.isBot && Number.isSafeInteger(payload.botMoves) && payload.botMoves >= player.botMoves) player.botMoves = payload.botMoves
    if (room.mode === 'items') {
      const milestone = Math.floor(cleared / ITEM_CHARGE_CELLS)
      while (player.itemMilestone < milestone) {
        const item = room.itemSequence % 2 === 0 ? 'pulse' : 'shield'
        player.items[item] = Math.min(3, player.items[item] + 1)
        player.itemMilestone += 1
        room.itemSequence += 1
      }
    }
    if ([...room.players.values()].every((entry) => entry.gameStatus === 'gameOver')) room.status = 'finished'
    this.#touch(room)
    return true
  }

  useItem(room, playerId, itemType, targetId) {
    if (room.mode !== 'items' || room.status !== 'playing') return null
    const player = room.players.get(playerId)
    if (!player?.connected || !['pulse', 'shield'].includes(itemType) || player.items[itemType] < 1) return null
    if (itemType === 'shield') {
      player.items.shield -= 1
      player.shielded = true
      this.#touch(room)
      return { eventId: this.id(), matchId: room.matchId, itemType, sourceId: playerId, targetId: playerId, blocked: false }
    }
    const target = room.players.get(String(targetId ?? ''))
    if (!target?.connected || target.id === playerId || target.gameStatus !== 'playing') return null
    player.items.pulse -= 1
    const blocked = target.shielded
    if (blocked) target.shielded = false
    this.#touch(room)
    return { eventId: this.id(), matchId: room.matchId, itemType, sourceId: playerId, targetId: target.id, blocked }
  }

  rematch(room, playerId) {
    const player = room.players.get(playerId)
    if (!player?.isHost || room.status !== 'finished') return false
    room.status = 'lobby'
    room.seed = ''
    room.matchId = ''
    room.startsAt = 0
    for (const entry of room.players.values()) {
      entry.ready = entry.isBot
      entry.score = 0
      entry.level = 1
      entry.cleared = 0
      entry.gameStatus = 'ready'
      entry.items = { pulse: 0, shield: 0 }
      entry.itemMilestone = 0
      entry.shielded = false
    }
    this.#touch(room)
    return true
  }

  markDisconnected(room, playerId) {
    const player = room.players.get(playerId)
    if (!player || player.isBot) return false
    player.connected = false
    player.ready = false
    player.disconnectedAt = this.now()
    this.#touch(room)
    return true
  }

  removePlayer(room, playerId) {
    const wasHost = room.players.get(playerId)?.isHost
    if (!room.players.delete(playerId)) return false
    if (room.players.size === 0 || [...room.players.values()].every((player) => player.isBot)) {
      this.rooms.delete(room.code)
      return true
    }
    if (wasHost) {
      const players = [...room.players.values()]
      const nextHost = players.find((entry) => entry.connected && !entry.isBot) ?? players.find((entry) => !entry.isBot)
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
        if (!player.isBot && !player.connected && player.disconnectedAt !== null && now - player.disconnectedAt >= reconnectGraceMs) {
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
      mode: room.mode,
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
          isHost: Boolean(entry.isHost), isBot: Boolean(entry.isBot), botDifficulty: ['rookie', 'pilot', 'ace'].includes(entry.botDifficulty) ? entry.botDifficulty : null,
          ready: Boolean(entry.isBot && source.status === 'lobby'), connected: Boolean(entry.isBot), disconnectedAt: entry.isBot ? null : now,
          score: Number.isSafeInteger(entry.score) ? entry.score : 0,
          level: Number.isSafeInteger(entry.level) ? entry.level : 1,
          cleared: Number.isSafeInteger(entry.cleared) ? entry.cleared : 0,
          gameStatus: entry.gameStatus === 'gameOver' ? 'gameOver' : entry.gameStatus === 'playing' ? 'playing' : 'ready',
          items: { pulse: Number(entry.items?.pulse) || 0, shield: Number(entry.items?.shield) || 0 },
          itemMilestone: Number(entry.itemMilestone) || 0, shielded: Boolean(entry.shielded),
          botMoves: Number(entry.botMoves) || 0,
        })
      }
      if (players.size === 0) continue
      const room = {
        code: this.#normalizeCode(source.code), mode: cleanMode(source.mode), itemSequence: Number(source.itemSequence) || 0,
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
      isBot: false, botDifficulty: null, botMoves: 0,
      score: 0, level: 1, cleared: 0, gameStatus: 'ready',
      items: { pulse: 0, shield: 0 }, itemMilestone: 0, shielded: false,
    }
  }

  #newBot(index, difficulty) {
    const level = ['rookie', 'pilot', 'ace'].includes(difficulty) ? difficulty : 'pilot'
    return {
      id: this.id(), reconnectToken: this.random(24).toString('base64url'), name: `Atlas AI ${index}`,
      isHost: false, isBot: true, botDifficulty: level, botMoves: 0,
      ready: true, connected: true, disconnectedAt: null,
      score: 0, level: 1, cleared: 0, gameStatus: 'ready',
      items: { pulse: 0, shield: 0 }, itemMilestone: 0, shielded: false,
    }
  }

  #normalizeCode(value) {
    return String(value ?? '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6)
  }

  #touch(room) {
    room.updatedAt = this.now()
  }
}
