import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { GravityStackEngine, GRAVITY_STACK_RULES_VERSION } from '../src/games/gravity-stack/core/engine.ts'
import { ATTACK_ITEMS, ITEM_SEQUENCE, RoomStore } from './roomStore.mjs'
import { BOT_ENGINE_VERSION, BOT_MOVE_INTERVALS, GravityBotEngine } from './gravityBot.mjs'
import { MAX_CONNECTIONS, MAX_CONNECTIONS_PER_ADDRESS, MAX_ROOMS, MAX_ROOM_CREATIONS_PER_WINDOW, MAX_TOTAL_BOTS, ROOM_CREATION_WINDOW_MS, SlidingWindowLimiter, clientAddress } from './security.mjs'
import { validateAtlasAccount } from './atlasAuth.mjs'

const PROTOCOL_VERSION = 3
const host = process.env.ARCADE_HOST || '127.0.0.1'
const port = Number(process.env.ARCADE_PORT || 4188)
const heartbeatIntervalMs = Math.max(500, Number(process.env.ARCADE_HEARTBEAT_MS) || 25_000)
const stateFile = process.env.ARCADE_STATE_FILE || ''
const allowedOrigins = new Set((process.env.ARCADE_ALLOWED_ORIGINS || 'http://127.0.0.1:4173,http://localhost:4173').split(',').map((value) => value.trim()).filter(Boolean))
const store = new RoomStore()
const sockets = new Map()
const connectionCounts = new Map()
const botRuns = new Map()
const humanRuns = new Map()
const roomCreationLimiter = new SlidingWindowLimiter({ windowMs: ROOM_CREATION_WINDOW_MS, limit: MAX_ROOM_CREATIONS_PER_WINDOW })
let persistTimer
let shuttingDown = false
let botStagger = 0
let eventLoopLagMs = 0
let buildInfo = null

try { buildInfo = JSON.parse(await readFile(new URL('../build-info.json', import.meta.url), 'utf8')) }
catch { buildInfo = null }

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
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = undefined
    persistNow().catch(() => console.error('Arcade state persist failed'))
  }, 250)
  persistTimer.unref()
}

await loadState()

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(JSON.stringify({ ok: true, service: 'arcade-multiplayer', rooms: store.rooms.size, connections: sockets.size, protocol: PROTOCOL_VERSION, gitSha: buildInfo?.gitSha ?? 'local-unversioned', artifactManifestSha256: buildInfo?.artifactManifestSha256 ?? 'local-unversioned', rulesVersion: GRAVITY_STACK_RULES_VERSION, botEngineVersion: BOT_ENGINE_VERSION, eventLoopLagMs, rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024) }))
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
    const engine = new GravityBotEngine(room.seed, player.botDifficulty, `${room.seed}:${player.id}`)
    if (restored && player.botMoves > 0) engine.replay(player.botMoves)
    const base = Math.max(Date.now(), restored ? Date.now() + 500 : room.startsAt)
    botRuns.set(player.id, { room, playerId: player.id, engine, nextAt: base + (botStagger++ % 50) * 20 })
  }
}

function startHumans(room, restored = false) {
  for (const player of room.players.values()) {
    if (player.isBot || player.gameStatus === 'gameOver') continue
    const engine = new GravityStackEngine(room.seed)
    if (restored && player.engineState) engine.restoreCheckpoint(player.engineState)
    humanRuns.set(player.id, { room, playerId: player.id, engine, lastAt: Math.max(Date.now(), room.startsAt), lastRevision: -1 })
  }
}

function stopRoomBots(room) {
  for (const [id, run] of botRuns) if (run.room === room) botRuns.delete(id)
}


function stopRoomHumans(room) {
  for (const [id, run] of humanRuns) if (run.room === room) humanRuns.delete(id)
}

function publishHumanState(run, force = false) {
  const player = run.room.players.get(run.playerId)
  if (!player) return false
  const checkpoint = run.engine.getCheckpoint()
  if (!force && checkpoint.revision === run.lastRevision) return false
  run.lastRevision = checkpoint.revision
  store.applyEngineState(run.room, player.id, checkpoint)
  broadcast(run.room, { type: 'playerState', playerId: player.id, sequence: player.inputSequence, state: checkpoint })
  broadcastRoom(run.room)
  if (run.room.status === 'finished') broadcast(run.room, { type: 'matchEnd', room: store.publicRoom(run.room) })
  queuePersist()
  return true
}

function letBotUseItem(room, player) {
  let event = null
  if (player.items.shield > 0 && !player.shielded) event = store.useItem(room, player.id, 'shield')
  else {
    const itemType = ITEM_SEQUENCE.find((item) => ATTACK_ITEMS.has(item) && player.items[item] > 0)
    const opponents = [...room.players.values()].filter((entry) => entry.id !== player.id && entry.connected && entry.gameStatus === 'playing')
    const target = opponents.sort((a, b) => (a.id === player.lastPulseTarget) - (b.id === player.lastPulseTarget) || b.score - a.score)[0]
    if (target && itemType) event = store.useItem(room, player.id, itemType, target.id)
  }
  if (event) {
    if (ATTACK_ITEMS.has(event.itemType)) player.lastPulseTarget = event.targetId
    applyItemEvent(room, event)
    broadcast(room, { type: 'itemEvent', ...event })
  }
}

function applyItemEvent(room, event) {
  if (event.blocked || !['pulse', 'garbage'].includes(event.itemType)) return
  const target = room.players.get(event.targetId)
  if (!target) return
  if (target.isBot) {
    const run = botRuns.get(target.id)
    if (run) {
      if (event.itemType === 'pulse') run.engine.forceDropCells(2)
      else run.engine.addGarbageRow(event.gapColumn)
      store.applyEngineState(room, target.id, run.engine.checkpoint(), { botMoves: run.engine.moves })
    }
  }
  else {
    const run = humanRuns.get(target.id)
    if (run) {
      if (event.itemType === 'pulse') run.engine.forceDropCells(2)
      else run.engine.addGarbageRow(event.gapColumn)
      publishHumanState(run, true)
    }
  }
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
  const session = { room: null, playerId: null, atlasAccount: null, authenticated: false, lastCommandAt: 0, messageTimes: [], alive: true, superseded: false, address }
  sockets.set(socket, session)
  send(socket, { type: 'connected', protocol: PROTOCOL_VERSION })
  socket.on('pong', () => { session.alive = true })

  socket.on('message', async (raw) => {
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
      if (message.type === 'authenticate') {
        const account = await validateAtlasAccount(message.accessToken)
        if (!account) {
          fail(socket, 'AUTH_REQUIRED')
          socket.close(1008, 'Atlas authentication required')
          return
        }
        session.atlasAccount = account
        session.authenticated = true
        send(socket, { type: 'authenticated' })
        return
      }
      if (!session.authenticated) return fail(socket, 'AUTH_REQUIRED')
      if (message.type === 'create') {
        if (session.room) return fail(socket, 'ALREADY_IN_ROOM')
        if (store.rooms.size >= MAX_ROOMS) return fail(socket, 'ROOM_CAPACITY_REACHED')
        if (!roomCreationLimiter.allow(address)) return fail(socket, 'ROOM_CREATION_LIMITED')
        const { room, player } = store.createRoom(session.atlasAccount?.nickname || message.name, message.mode)
        attachSession(socket, session, room, player)
        send(socket, { type: 'joined', playerId: player.id, reconnectToken: player.reconnectToken, room: store.publicRoom(room) })
        queuePersist()
        return
      }
      if (message.type === 'join') {
        if (session.room) return fail(socket, 'ALREADY_IN_ROOM')
        const { room, player } = store.joinRoom(message.code, session.atlasAccount?.nickname || message.name)
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
        const run = humanRuns.get(player.id)
        if (run) send(socket, { type: 'playerState', playerId: player.id, sequence: player.inputSequence, state: run.engine.getCheckpoint() })
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
        startHumans(session.room)
        broadcast(session.room, { type: 'matchStart', ...match })
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'input') {
        const commands = new Set(['left', 'right', 'rotate', 'down', 'hardDrop'])
        const run = humanRuns.get(session.playerId)
        if (!run) return fail(socket, 'ENGINE_NOT_READY')
        if (!commands.has(message.command) || !store.acceptInput(session.room, session.playerId, message.sequence)) return fail(socket, 'INVALID_INPUT')
        const player = session.room.players.get(session.playerId)
        if (message.command === 'rotate' && store.effectActive(player, 'rotationLockUntil')) return fail(socket, 'ROTATION_LOCKED')
        const minimumInterval = message.command === 'hardDrop' ? 70 : 25
        if (now - session.lastCommandAt < minimumInterval) {
          fail(socket, 'INPUT_RATE_LIMITED')
          publishHumanState(run, true)
          return
        }
        session.lastCommandAt = now
        run.engine.execute(message.command)
        publishHumanState(run, true)
        return
      }
      if (message.type === 'useItem') {
        const event = store.useItem(session.room, session.playerId, message.itemType, message.targetId)
        if (!event) return fail(socket, 'INVALID_ITEM')
        applyItemEvent(session.room, event)
        broadcast(session.room, { type: 'itemEvent', ...event })
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'forfeit') {
        if (!store.forfeit(session.room, session.playerId)) return fail(socket, 'INVALID_STATE')
        humanRuns.delete(session.playerId)
        broadcastRoom(session.room)
        if (session.room.status === 'finished') broadcast(session.room, { type: 'matchEnd', room: store.publicRoom(session.room) })
        queuePersist()
        return
      }
      if (message.type === 'rematch') {
        if (!store.rematch(session.room, session.playerId)) return fail(socket, 'INVALID_STATE')
        stopRoomBots(session.room)
        stopRoomHumans(session.room)
        broadcast(session.room, { type: 'rematch', room: store.publicRoom(session.room) })
        broadcastRoom(session.room)
        queuePersist()
        return
      }
      if (message.type === 'leave') {
        const room = session.room
        store.removePlayer(room, session.playerId)
        humanRuns.delete(session.playerId)
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
    const snapshot = run.engine.step({ allowRotation: !store.effectActive(player, 'rotationLockUntil', now) })
    const speedMultiplier = store.effectActive(player, 'speedUpUntil', now) ? 0.55 : 1
    run.nextAt = now + BOT_MOVE_INTERVALS[player.botDifficulty] * speedMultiplier
    if (!store.applyEngineState(run.room, player.id, run.engine.checkpoint(), { botMoves: snapshot.moves })) { botRuns.delete(id); continue }
    letBotUseItem(run.room, player)
    broadcastRoom(run.room)
    if (run.room.status === 'finished') broadcast(run.room, { type: 'matchEnd', room: store.publicRoom(run.room) })
    queuePersist()
  }
}, 100)
botInterval.unref()

const humanInterval = setInterval(() => {
  const now = Date.now()
  for (const [id, run] of humanRuns) {
    const player = run.room.players.get(run.playerId)
    if (store.rooms.get(run.room.code) !== run.room || !player || run.room.status !== 'playing' || player.gameStatus === 'gameOver') { humanRuns.delete(id); continue }
    if (now < run.room.startsAt) continue
    if (run.engine.getSnapshot().status === 'ready') run.engine.start()
    const speedMultiplier = store.effectActive(player, 'speedUpUntil', now) ? 1.8 : 1
    const delta = Math.max(0, Math.min(250, now - run.lastAt)) * speedMultiplier
    run.lastAt = now
    if (run.engine.tick(delta)) publishHumanState(run)
    else if (run.lastRevision < 0) publishHumanState(run, true)
  }
}, 50)
humanInterval.unref()

let lagExpectedAt = Date.now() + 1000
const lagInterval = setInterval(() => {
  const now = Date.now()
  eventLoopLagMs = Math.max(0, now - lagExpectedAt)
  lagExpectedAt = now + 1000
}, 1000)
lagInterval.unref()

for (const room of store.rooms.values()) if (room.status === 'playing') { startBots(room, true); startHumans(room, true) }

server.listen(port, host, () => console.log(`Arcade multiplayer listening on http://${host}:${port}`))

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(heartbeat)
  clearInterval(sweepInterval)
  clearInterval(botInterval)
  clearInterval(humanInterval)
  clearInterval(lagInterval)
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
