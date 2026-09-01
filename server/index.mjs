import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { RoomStore } from './roomStore.mjs'
import { BOT_MOVE_INTERVALS, GravityBotEngine } from './gravityBot.mjs'
import { MAX_CONNECTIONS, MAX_CONNECTIONS_PER_ADDRESS, MAX_ROOMS, MAX_ROOM_CREATIONS_PER_WINDOW, MAX_TOTAL_BOTS, ROOM_CREATION_WINDOW_MS, SlidingWindowLimiter, clientAddress } from './security.mjs'

const PROTOCOL_VERSION = 1
const host = process.env.ARCADE_HOST || '127.0.0.1'
const port = Number(process.env.ARCADE_PORT || 4188)
const heartbeatIntervalMs = Math.max(500, Number(process.env.ARCADE_HEARTBEAT_MS) || 25_000)
const stateFile = process.env.ARCADE_STATE_FILE || ''
const allowedOrigins = new Set((process.env.ARCADE_ALLOWED_ORIGINS || 'http://127.0.0.1:4173,http://localhost:4173').split(',').map((value) => value.trim()).filter(Boolean))
const store = new RoomStore()
const sockets = new Map()
const connectionCounts = new Map()
const botRuns = new Map()
const roomCreationLimiter = new SlidingWindowLimiter({ windowMs: ROOM_CREATION_WINDOW_MS, limit: MAX_ROOM_CREATIONS_PER_WINDOW })
let persistTimer
let shuttingDown = false

async function loadState() {
  if (!stateFile) return
  try { store.hydrate(JSON.parse(await readFile(stateFile, 'utf8'))) }
  catch (error) {
    if (error?.code !== 'ENOENT') console.error('Arcade state restore failed')
  }
}

async function persistNow() {
  if (!stateFile) return
  const temporary = `${stateFile}.tmp`
  await mkdir(dirname(stateFile), { recursive: true })
  await writeFile(temporary, `${JSON.stringify(store.serialize())}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, stateFile)
}

function queuePersist() {
  if (!stateFile) return
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => persistNow().catch(() => console.error('Arcade state persist failed')), 40)
  persistTimer.unref()
}

await loadState()

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(JSON.stringify({ ok: true, service: 'arcade-multiplayer', rooms: store.rooms.size, connections: sockets.size, protocol: PROTOCOL_VERSION }))
    return
  }
  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ error: 'NOT_FOUND' }))
})

const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 8 * 1024,
  perMessageDeflate: false,
  verifyClient: ({ origin }, done) => done(allowedOrigins.has(origin), 403, 'Origin not allowed'),
})

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
}

function broadcast(room, payload) {
  for (const [socket, session] of sockets) {
    if (session.room === room) send(socket, payload)
  }
}

function broadcastRoom(room) {
  broadcast(room, { type: 'roomState', room: store.publicRoom(room) })
}

function startBots(room, restored = false) {
  for (const player of room.players.values()) {
    if (!player.isBot || player.gameStatus === 'gameOver') continue
    const engine = new GravityBotEngine(room.seed, player.botDifficulty)
    if (restored && player.botMoves > 0) engine.replay(player.botMoves)
    botRuns.set(player.id, { room, playerId: player.id, engine, nextAt: Math.max(Date.now(), restored ? Date.now() + 500 : room.startsAt) })
  }
}

function stopRoomBots(room) {
  for (const [id, run] of botRuns) if (run.room === room) botRuns.delete(id)
}

function letBotUseItem(room, player) {
  let event = null
  if (player.items.shield > 0 && !player.shielded) event = store.useItem(room, player.id, 'shield')
  else if (player.items.pulse > 0) {
    const target = [...room.players.values()].filter((entry) => !entry.isBot && entry.connected && entry.gameStatus === 'playing').sort((a, b) => b.score - a.score)[0]
    if (target) event = store.useItem(room, player.id, 'pulse', target.id)
  }
  if (event) broadcast(room, { type: 'itemEvent', ...event })
}

function fail(socket, code) {
  send(socket, { type: 'error', code })
}

function attachSession(socket, session, room, player) {
  for (const [otherSocket, other] of sockets) {
    if (otherSocket !== socket && other.room === room && other.playerId === player.id) {
      other.superseded = true
      otherSocket.close(4001, 'Reconnected elsewhere')
    }
  }
  session.room = room
  session.playerId = player.id
}

wss.on('connection', (socket, request) => {
  const address = clientAddress(request)
  const addressConnections = connectionCounts.get(address) ?? 0
  if (sockets.size >= MAX_CONNECTIONS || addressConnections >= MAX_CONNECTIONS_PER_ADDRESS) {
    socket.close(1013, 'Connection limit')
    return
  }
  connectionCounts.set(address, addressConnections + 1)
  const session = { room: null, playerId: null, lastProgressAt: 0, messageTimes: [], alive: true, superseded: false, address }
  sockets.set(socket, session)
  send(socket, { type: 'connected', protocol: PROTOCOL_VERSION })
  socket.on('pong', () => { session.alive = true })

  socket.on('message', (raw) => {
    const now = Date.now()
    session.messageTimes = session.messageTimes.filter((time) => now - time < 10_000)
    if (session.messageTimes.length >= 180) {
      fail(socket, 'RATE_LIMITED')
      socket.close(1008, 'Rate limit')
      return
    }
    session.messageTimes.push(now)
    let message
    try { message = JSON.parse(raw.toString()) }
    catch { return fail(socket, 'INVALID_MESSAGE') }
    if (!message || typeof message.type !== 'string') return fail(socket, 'INVALID_MESSAGE')
    if (message.protocol !== PROTOCOL_VERSION) return fail(socket, 'PROTOCOL_MISMATCH')
    try {
      if (message.type === 'create') {
        if (session.room) return fail(socket, 'ALREADY_IN_ROOM')
        if (store.rooms.size >= MAX_ROOMS) return fail(socket, 'ROOM_CAPACITY_REACHED')
        if (!roomCreationLimiter.allow(address)) return fail(socket, 'ROOM_CREATION_LIMITED')
        const { room, player } = store.createRoom(message.name, message.mode)
        attachSession(socket, session, room, player)
        send(socket, { type: 'joined', playerId: player.id, reconnectToken: player.reconnectToken, room: store.publicRoom(room) })
        queuePersist()
        return
      }
      if (message.type === 'join') {
        if (session.room) return fail(socket, 'ALREADY_IN_ROOM')
        const { room, player } = store.joinRoom(message.code, message.name)
        attachSession(socket, session, room, player)
        send(socket, { type: 'joined', playerId: player.id, reconnectToken: player.reconnectToken, room: store.publicRoom(room) })
        broadcastRoom(room)
        queuePersist()
        return
      }
      if (message.type === 'resume') {
        if (session.room) return fail(socket, 'ALREADY_IN_ROOM')
        const { room, player } = store.resumeRoom(message.code, message.playerId, message.reconnectToken)
        attachSession(socket, session, room, player)
        send(socket, { type: 'resumed', playerId: player.id, reconnectToken: player.reconnectToken, room: store.publicRoom(room) })
        if (room.status === 'playing') send(socket, { type: 'matchStart', ...store.matchState(room), resumed: true })
        broadcastRoom(room)
        queuePersist()
        return
      }
      if (!session.room || !session.playerId) return fail(socket, 'NOT_IN_ROOM')
      if (message.type === 'ready') {
        if (!store.setReady(session.room, session.playerId, message.ready)) return fail(socket, 'INVALID_STATE')
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'addBot') {
        const botCount = [...store.rooms.values()].reduce((sum, room) => sum + [...room.players.values()].filter((player) => player.isBot).length, 0)
        if (botCount >= MAX_TOTAL_BOTS) return fail(socket, 'BOT_CAPACITY_REACHED')
        store.addBot(session.room, session.playerId, message.difficulty)
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'removeBot') {
        if (!store.removeBot(session.room, session.playerId, message.botId)) return fail(socket, 'INVALID_STATE')
        botRuns.delete(String(message.botId ?? ''))
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'start') {
        if (!store.canStart(session.room, session.playerId)) return fail(socket, 'NOT_READY')
        const match = store.start(session.room)
        startBots(session.room)
        broadcast(session.room, { type: 'matchStart', ...match })
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'progress') {
        if (now - session.lastProgressAt < 80) return
        session.lastProgressAt = now
        if (!store.updateProgress(session.room, session.playerId, message)) return fail(socket, 'INVALID_PROGRESS')
        broadcastRoom(session.room)
        if (session.room.status === 'finished') broadcast(session.room, { type: 'matchEnd', room: store.publicRoom(session.room) })
        queuePersist()
        return
      }
      if (message.type === 'useItem') {
        const event = store.useItem(session.room, session.playerId, message.itemType, message.targetId)
        if (!event) return fail(socket, 'INVALID_ITEM')
        if (event.itemType === 'pulse' && !event.blocked && session.room.players.get(event.targetId)?.isBot) {
          const run = botRuns.get(event.targetId)
          if (run) run.nextAt = 0
        }
        broadcast(session.room, { type: 'itemEvent', ...event })
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'rematch') {
        if (!store.rematch(session.room, session.playerId)) return fail(socket, 'INVALID_STATE')
        stopRoomBots(session.room)
        broadcast(session.room, { type: 'rematch', room: store.publicRoom(session.room) })
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'leave') {
        const room = session.room
        store.removePlayer(room, session.playerId)
        session.room = null
        session.playerId = null
        if (store.rooms.has(room.code)) broadcastRoom(room)
        queuePersist()
        return
      }
      fail(socket, 'UNKNOWN_MESSAGE')
    }
    catch (error) {
      fail(socket, error instanceof Error ? error.message : 'SERVER_ERROR')
    }
  })

  socket.on('close', () => {
    sockets.delete(socket)
    const count = (connectionCounts.get(session.address) ?? 1) - 1
    if (count <= 0) connectionCounts.delete(session.address)
    else connectionCounts.set(session.address, count)
    if (!session.superseded && session.room && session.playerId) {
      store.markDisconnected(session.room, session.playerId)
      broadcastRoom(session.room)
      queuePersist()
    }
  })
})

const heartbeat = setInterval(() => {
  for (const [socket, session] of sockets) {
    if (!session.alive) socket.terminate()
    else {
      session.alive = false
      socket.ping()
    }
  }
}, heartbeatIntervalMs)
heartbeat.unref()

const sweepInterval = setInterval(() => {
  const result = store.sweep()
  roomCreationLimiter.sweep()
  for (const room of result.rooms) {
    broadcastRoom(room)
    if (room.status === 'finished') broadcast(room, { type: 'matchEnd', room: store.publicRoom(room) })
  }
  if (result.changed) queuePersist()
}, 2_000)
sweepInterval.unref()

const botInterval = setInterval(() => {
  const now = Date.now()
  for (const [id, run] of botRuns) {
    const player = run.room.players.get(run.playerId)
    if (store.rooms.get(run.room.code) !== run.room || !player || run.room.status !== 'playing' || player.gameStatus === 'gameOver') { botRuns.delete(id); continue }
    if (now < run.nextAt) continue
    const snapshot = run.engine.step()
    run.nextAt = now + BOT_MOVE_INTERVALS[player.botDifficulty]
    if (!store.updateProgress(run.room, player.id, { matchId: run.room.matchId, ...snapshot, botMoves: snapshot.moves })) { botRuns.delete(id); continue }
    letBotUseItem(run.room, player)
    broadcastRoom(run.room)
    if (run.room.status === 'finished') broadcast(run.room, { type: 'matchEnd', room: store.publicRoom(run.room) })
    queuePersist()
  }
}, 100)
botInterval.unref()

for (const room of store.rooms.values()) if (room.status === 'playing') startBots(room, true)

server.listen(port, host, () => console.log(`Arcade multiplayer listening on http://${host}:${port}`))

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(heartbeat)
  clearInterval(sweepInterval)
  clearInterval(botInterval)
  clearTimeout(persistTimer)
  try { await persistNow() }
  catch { console.error('Arcade state persist failed during shutdown') }
  for (const socket of sockets.keys()) {
    send(socket, { type: 'serverRestart' })
    socket.close(1012, 'Service restart')
  }
  wss.close(() => server.close(() => process.exit(0)))
  setTimeout(() => process.exit(1), 5000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
