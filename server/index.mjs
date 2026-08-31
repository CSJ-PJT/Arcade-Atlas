import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { RoomStore } from './roomStore.mjs'

const host = process.env.ARCADE_HOST || '127.0.0.1'
const port = Number(process.env.ARCADE_PORT || 4188)
const allowedOrigins = new Set((process.env.ARCADE_ALLOWED_ORIGINS || 'http://127.0.0.1:4173,http://localhost:4173').split(',').map((value) => value.trim()).filter(Boolean))
const store = new RoomStore()

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(JSON.stringify({ ok: true, service: 'arcade-multiplayer', rooms: store.rooms.size }))
    return
  }
  response.writeHead(404, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ error: 'NOT_FOUND' }))
})

const sockets = new Map()
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

function fail(socket, code) {
  send(socket, { type: 'error', code })
}

wss.on('connection', (socket) => {
  sockets.set(socket, { room: null, playerId: null, lastProgressAt: 0 })
  send(socket, { type: 'connected' })

  socket.on('message', (raw) => {
    let message
    try { message = JSON.parse(raw.toString()) }
    catch { return fail(socket, 'INVALID_MESSAGE') }
    if (!message || typeof message.type !== 'string') return fail(socket, 'INVALID_MESSAGE')
    const session = sockets.get(socket)
    if (!session) return
    try {
      if (message.type === 'create') {
        if (session.room) return fail(socket, 'ALREADY_IN_ROOM')
        const { room, player } = store.createRoom(message.name)
        session.room = room
        session.playerId = player.id
        send(socket, { type: 'joined', playerId: player.id, room: store.publicRoom(room) })
        return
      }
      if (message.type === 'join') {
        if (session.room) return fail(socket, 'ALREADY_IN_ROOM')
        const { room, player } = store.joinRoom(message.code, message.name)
        session.room = room
        session.playerId = player.id
        send(socket, { type: 'joined', playerId: player.id, room: store.publicRoom(room) })
        broadcastRoom(room)
        return
      }
      if (!session.room || !session.playerId) return fail(socket, 'NOT_IN_ROOM')
      if (message.type === 'ready') {
        if (!store.setReady(session.room, session.playerId, message.ready)) return fail(socket, 'INVALID_STATE')
        broadcastRoom(session.room)
        return
      }
      if (message.type === 'start') {
        if (!store.canStart(session.room, session.playerId)) return fail(socket, 'NOT_READY')
        const match = store.start(session.room)
        broadcast(session.room, { type: 'matchStart', ...match })
        broadcastRoom(session.room)
        return
      }
      if (message.type === 'progress') {
        const now = Date.now()
        if (now - session.lastProgressAt < 80) return
        session.lastProgressAt = now
        if (!store.updateProgress(session.room, session.playerId, message)) return fail(socket, 'INVALID_PROGRESS')
        broadcastRoom(session.room)
        return
      }
      fail(socket, 'UNKNOWN_MESSAGE')
    }
    catch (error) {
      fail(socket, error instanceof Error ? error.message : 'SERVER_ERROR')
    }
  })

  socket.on('close', () => {
    const session = sockets.get(socket)
    sockets.delete(socket)
    if (session?.room && session.playerId) {
      store.removePlayer(session.room, session.playerId)
      if (store.rooms.has(session.room.code)) broadcastRoom(session.room)
    }
  })
})

const interval = setInterval(() => store.sweep(), 60_000)
interval.unref()
server.listen(port, host, () => console.log(`Arcade multiplayer listening on http://${host}:${port}`))

function shutdown() {
  wss.close(() => server.close(() => process.exit(0)))
  setTimeout(() => process.exit(1), 5000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
